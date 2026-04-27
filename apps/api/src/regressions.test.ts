import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildServer } from './server.js';
import { loadConfig } from './config.js';

// Focused regressions for the issues raised in review. One server per suite so
// each test starts from a clean admin-bootstrapped state.
describe('regressions', () => {
  let tmp: string;
  let app: FastifyInstance;
  let lastOtp: string | undefined;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'ovote-regression-'));
    const config = loadConfig({
      OVOTE_API_PORT: '0',
      OVOTE_DB_PATH: join(tmp, 'test.sqlite'),
      OVOTE_LOG_LEVEL: 'error',
      OVOTE_BLIND_RSA_MODULUS: '2048',
      OVOTE_ADMIN_BOOTSTRAP_EMAIL: 'admin@example.test',
    } as NodeJS.ProcessEnv);
    app = await buildServer({ config });
    app.log.warn = ((obj: unknown) => {
      if (obj && typeof obj === 'object' && 'code' in obj) {
        lastOtp = String((obj as { code: string }).code);
      }
    }) as typeof app.log.warn;
  }, 30_000);

  afterAll(async () => {
    await app.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  async function login(email: string): Promise<string> {
    const reqRes = await app.inject({
      method: 'POST',
      url: '/auth/otp/request',
      payload: { email },
    });
    expect(reqRes.statusCode).toBe(202);
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/auth/otp/verify',
      payload: { email, code: lastOtp },
    });
    expect(verifyRes.statusCode).toBe(200);
    return (verifyRes.json() as { sessionToken: string }).sessionToken;
  }

  it('POST /auth/logout revokes the bearer token', async () => {
    const token = await login('admin@example.test');

    // Pre-check: token is accepted.
    const okRes = await app.inject({
      method: 'GET',
      url: '/admin/voters',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(okRes.statusCode).toBe(200);

    // Logout.
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(logoutRes.statusCode).toBe(200);

    // Post-check: token is gone.
    const goneRes = await app.inject({
      method: 'GET',
      url: '/admin/voters',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(goneRes.statusCode).toBe(401);
  });

  it('returns 400 (not 500) when a ballot carries malformed base64url', async () => {
    const adminToken = await login('admin@example.test');

    // Create a minimal open agenda we can target. We skip the real crypto —
    // we only need the request to reach parseBallot/verifyBallot.
    const createRes = await app.inject({
      method: 'POST',
      url: '/agendas',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'malformed test',
        description: '',
        openAt: new Date(Date.now() - 1_000).toISOString(),
        closeAt: new Date(Date.now() + 60_000).toISOString(),
        options: [
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' },
        ],
        key: {
          // The /agendas route accepts a groupPk string verbatim; we never
          // touch it in this test because we reject at verifyBallot first.
          groupPk: 'A'.repeat(43),
          threshold: 1,
          n: 1,
          trustees: [{ index: 1, pk: 'A'.repeat(43) }],
        },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const agendaId = (createRes.json() as { id: string }).id;

    await app.inject({
      method: 'POST',
      url: `/agendas/${agendaId}/open`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    // Ballot payload whose shape is valid per Zod but whose curve-point
    // bytes are bogus — the verifier must catch this before the chain does.
    const garbage = 'A'.repeat(43);
    const ballotRes = await app.inject({
      method: 'POST',
      url: '/ballots',
      payload: {
        id: '00000000-0000-4000-8000-000000000000',
        agendaId,
        options: [
          {
            optionId: 'yes',
            ciphertext: { c1: garbage, c2: garbage },
            proof: [
              { commitmentA: garbage, commitmentB: garbage, challenge: garbage, response: garbage },
              { commitmentA: garbage, commitmentB: garbage, challenge: garbage, response: garbage },
            ],
          },
          {
            optionId: 'no',
            ciphertext: { c1: garbage, c2: garbage },
            proof: [
              { commitmentA: garbage, commitmentB: garbage, challenge: garbage, response: garbage },
              { commitmentA: garbage, commitmentB: garbage, challenge: garbage, response: garbage },
            ],
          },
        ],
        sumProof: { commitment: `${garbage}.${garbage}`, response: garbage },
        // Above: Schnorr equality-of-DLogs commitments are encoded as "A.B"
        // (two Ristretto points). Format is valid; the points are garbage.
        credential: { nonce: garbage, signature: garbage },
        castAt: new Date().toISOString(),
        transcript: '{}',
      },
    });
    expect(ballotRes.statusCode).toBe(400);
  });

  it('refuses to demote the last admin', async () => {
    const adminToken = await login('admin@example.test');

    // Only one admin exists (bootstrap). Self-demote must fail.
    const demoteRes = await app.inject({
      method: 'POST',
      url: '/admin/voters/role',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { email: 'admin@example.test', role: 'voter' },
    });
    expect(demoteRes.statusCode).toBe(409);
    expect((demoteRes.json() as { error: string }).error).toMatch(/last remaining admin/);

    // A second admin unlocks demotion. Log the second user in first so the
    // voter row exists, then promote via the API.
    await login('admin2@example.test');
    const promoteRes = await app.inject({
      method: 'POST',
      url: '/admin/voters/role',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { email: 'admin2@example.test', role: 'admin' },
    });
    expect(promoteRes.statusCode).toBe(200);

    const okDemoteRes = await app.inject({
      method: 'POST',
      url: '/admin/voters/role',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { email: 'admin@example.test', role: 'voter' },
    });
    expect(okDemoteRes.statusCode).toBe(200);
  });
});
