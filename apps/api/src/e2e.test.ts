import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { BlindSignature, ElGamal, Disjunctive, Ristretto, Threshold } from '@ovote/crypto';
import { toB64Url } from '@ovote/shared';
import { buildServer } from './server.js';
import { loadConfig } from './config.js';

describe('API end-to-end: create agenda -> issue credential -> cast ballot -> close -> tally', () => {
  let tmp: string;
  let app: FastifyInstance;
  let lastOtp: string | undefined;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'ovote-api-test-'));
    const dbPath = join(tmp, 'test.sqlite');
    const config = loadConfig({
      OVOTE_API_PORT: '0',
      OVOTE_DB_PATH: dbPath,
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
    expect(lastOtp).toBeTruthy();
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/auth/otp/verify',
      payload: { email, code: lastOtp },
    });
    expect(verifyRes.statusCode).toBe(200);
    const body = verifyRes.json() as { sessionToken: string };
    return body.sessionToken;
  }

  it('runs the full ballot lifecycle', async () => {
    // 1) Admin bootstrap → log in as admin
    const adminToken = await login('admin@example.test');

    // 2) Trustees: generate t-of-n threshold key with trusted dealer
    const { publicParams, shares } = Threshold.trustedDealerKeygen(2, 3);
    const agendaCreateRes = await app.inject({
      method: 'POST',
      url: '/agendas',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Test Election',
        description: 'vitest',
        openAt: new Date(Date.now() - 60_000).toISOString(),
        closeAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        options: [
          { id: 'alice', label: 'Alice' },
          { id: 'bob', label: 'Bob' },
        ],
        key: {
          groupPk: Ristretto.pointToB64Url(publicParams.groupPk),
          threshold: publicParams.threshold,
          n: publicParams.n,
          trustees: publicParams.shares.map((s) => ({
            index: s.index,
            pk: Ristretto.pointToB64Url(s.pk),
          })),
        },
      },
    });
    expect(agendaCreateRes.statusCode).toBe(201);
    const agenda = agendaCreateRes.json() as { id: string; registrarBlindPk: string };

    // 3) Open agenda
    const openRes = await app.inject({
      method: 'POST',
      url: `/agendas/${agenda.id}/open`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(openRes.statusCode).toBe(200);

    // 4) Admin adds a voter to eligibility
    const voterEmail = `voter-${randomUUID()}@example.test`;
    const eligRes = await app.inject({
      method: 'POST',
      url: `/agendas/${agenda.id}/eligibility`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { emails: [voterEmail] },
    });
    expect(eligRes.statusCode).toBe(200);

    // 5) Voter logs in
    const voterToken = await login(voterEmail);

    // 6) Voter gets registrar's blind-signing public key from the agenda
    const registrarPk = await BlindSignature.importPublicKey(agenda.registrarBlindPk);

    // 7) Voter prepares a random credential token, blinds, asks registrar to sign
    const rawNonce = new Uint8Array(32);
    globalThis.crypto.getRandomValues(rawNonce);
    const preparedNonce = BlindSignature.prepareMessage(rawNonce);
    const { blindedMsg, inv } = await BlindSignature.blindMessage(registrarPk, preparedNonce);

    const signRes = await app.inject({
      method: 'POST',
      url: '/credentials/blind-sign',
      headers: { authorization: `Bearer ${voterToken}` },
      payload: {
        agendaId: agenda.id,
        blindedMessage: toB64Url(blindedMsg),
      },
    });
    expect(signRes.statusCode).toBe(200);
    const { blindSignature } = signRes.json() as { blindSignature: string };

    // 8) Voter unblinds to get a valid signature on preparedNonce
    const blindSig = new Uint8Array(Buffer.from(blindSignature.replaceAll('-', '+').replaceAll('_', '/'), 'base64'));
    const signature = await BlindSignature.finalize(registrarPk, preparedNonce, blindSig, inv);

    // 9) Voter builds ballot: vote for Alice (1), not Bob (0)
    const agendaRes = await app.inject({ method: 'GET', url: `/agendas/${agenda.id}` });
    const fetched = agendaRes.json() as { key: { groupPk: string } };
    const groupPkPoint = Ristretto.pointFromB64Url(fetched.key.groupPk);
    const pts = Disjunctive.zeroOrOneMessagePoints();

    const aliceVote = 1;
    const bobVote = 0;
    const aliceEnc = ElGamal.encryptPoint(groupPkPoint, pts[aliceVote]!);
    const bobEnc = ElGamal.encryptPoint(groupPkPoint, pts[bobVote]!);

    const aliceProof = Disjunctive.proveMembership({
      domain: 'ballot',
      pk: groupPkPoint,
      ct: aliceEnc.ct,
      messagePoints: pts,
      actualIndex: aliceVote,
      randomness: aliceEnc.r,
    });
    const bobProof = Disjunctive.proveMembership({
      domain: 'ballot',
      pk: groupPkPoint,
      ct: bobEnc.ct,
      messagePoints: pts,
      actualIndex: bobVote,
      randomness: bobEnc.r,
    });

    const ballot = {
      id: randomUUID(),
      agendaId: agenda.id,
      options: [
        {
          optionId: 'alice',
          ciphertext: {
            c1: Ristretto.pointToB64Url(aliceEnc.ct.c1),
            c2: Ristretto.pointToB64Url(aliceEnc.ct.c2),
          },
          proof: aliceProof.parts,
        },
        {
          optionId: 'bob',
          ciphertext: {
            c1: Ristretto.pointToB64Url(bobEnc.ct.c1),
            c2: Ristretto.pointToB64Url(bobEnc.ct.c2),
          },
          proof: bobProof.parts,
        },
      ],
      credential: {
        nonce: toB64Url(preparedNonce),
        signature: toB64Url(signature),
      },
      castAt: new Date().toISOString(),
      transcript: '{}',
    };

    const castRes = await app.inject({
      method: 'POST',
      url: '/ballots',
      payload: ballot,
    });
    expect(castRes.statusCode).toBe(201);

    // 10) Duplicate cast rejected
    const dupRes = await app.inject({
      method: 'POST',
      url: '/ballots',
      payload: { ...ballot, id: randomUUID() },
    });
    expect(dupRes.statusCode).toBe(409);

    // 11) List ballots — one present
    const listRes = await app.inject({ method: 'GET', url: `/ballots/${agenda.id}` });
    expect(listRes.statusCode).toBe(200);
    expect((listRes.json() as { ballots: unknown[] }).ballots.length).toBe(1);

    // 12) Admin closes agenda; verify shares-and-tally off-chain logic (we
    //     don't round-trip through the chaincode here, just prove the crypto
    //     lib can decrypt the aggregate)
    const closeRes = await app.inject({
      method: 'POST',
      url: `/agendas/${agenda.id}/close`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(closeRes.statusCode).toBe(200);

    // Aggregate encrypted ciphertext for Alice across the single ballot
    const aggregate = aliceEnc.ct;
    const quorum = shares.slice(0, 2);
    const decShares = quorum.map((s) => Threshold.partialDecrypt(s, aggregate));
    for (const ds of decShares) {
      const trustee = publicParams.shares.find((x) => x.index === ds.index)!;
      expect(
        Threshold.verifyDecryptionShare({ shareValue: ds, trusteePk: trustee.pk, ct: aggregate }),
      ).toBe(true);
    }
    const messagePoint = Threshold.combineShares(decShares, aggregate);
    expect(ElGamal.discreteLog(messagePoint, 5)).toBe(1);
  }, 60_000);
});
