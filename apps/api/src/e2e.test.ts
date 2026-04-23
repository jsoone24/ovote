import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { BlindSignature, ElGamal, Disjunctive, Ristretto, Threshold } from '@ovote/crypto';
import { toB64Url } from '@ovote/shared';
import { buildServer } from './server.js';
import { loadConfig } from './config.js';

describe('API end-to-end: create agenda -> issue credential -> cast ballot -> close -> tally', () => {
  let tmp: string;
  let app: FastifyInstance;
  let lastOtp: string | undefined;

  let dbPath: string;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'ovote-api-test-'));
    dbPath = join(tmp, 'test.sqlite');
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

    // 12) Admin closes agenda
    const closeRes = await app.inject({
      method: 'POST',
      url: `/agendas/${agenda.id}/close`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(closeRes.statusCode).toBe(200);

    // 13) Register two trustees and promote them directly in the DB (the
    //     bootstrap admin is the only out-of-band role today; trustees are
    //     set up by operators, not through a public API).
    const trusteeEmails = [`t1-${randomUUID()}@example.test`, `t2-${randomUUID()}@example.test`];
    const trusteeTokens: string[] = [];
    for (const email of trusteeEmails) {
      trusteeTokens.push(await login(email));
    }
    const sideDb = new Database(dbPath);
    const stmt = sideDb.prepare(`UPDATE voters SET role = 'trustee' WHERE email = ?`);
    for (const email of trusteeEmails) stmt.run(email);
    sideDb.close();

    // 14) GET aggregate — public endpoint, returns the homomorphic sum of
    //     ciphertexts per option. With one ballot for Alice (vote=1, bob=0)
    //     the aggregate must decrypt to 1 for alice and 0 for bob.
    const aggRes = await app.inject({ method: 'GET', url: `/agendas/${agenda.id}/aggregate` });
    expect(aggRes.statusCode).toBe(200);
    const aggregate = (aggRes.json() as {
      options: { optionId: string; c1: string; c2: string }[];
    }).options;
    expect(aggregate).toHaveLength(2);

    // 15) Each trustee computes and submits decryption shares for every option
    for (let i = 0; i < 2; i++) {
      const trusteeShare = shares[i]!;
      for (const a of aggregate) {
        const ct = {
          c1: Ristretto.pointFromB64Url(a.c1),
          c2: Ristretto.pointFromB64Url(a.c2),
        };
        const partial = Threshold.partialDecrypt(trusteeShare, ct);
        const body = {
          share: {
            agendaId: agenda.id,
            optionId: a.optionId,
            trusteeIndex: trusteeShare.index,
            share: toB64Url(Ristretto.pointToBytes(partial.share)),
            proof: partial.proof,
            submittedAt: new Date().toISOString(),
          },
        };
        const subRes = await app.inject({
          method: 'POST',
          url: '/decryption-shares',
          headers: { authorization: `Bearer ${trusteeTokens[i]}` },
          payload: body,
        });
        expect(subRes.statusCode).toBe(201);
      }
    }

    // 16) A tampered share must be rejected by the proof check. We submit
    //     a well-formed share whose value is wrong (zero point) so the Chaum-
    //     Pedersen equality-of-DLogs verification fails.
    const realShare = Threshold.partialDecrypt(shares[2]!, {
      c1: Ristretto.pointFromB64Url(aggregate[0]!.c1),
      c2: Ristretto.pointFromB64Url(aggregate[0]!.c2),
    });
    const badShare = {
      share: {
        agendaId: agenda.id,
        optionId: aggregate[0]!.optionId,
        trusteeIndex: shares[2]!.index,
        share: toB64Url(Ristretto.pointToBytes(Ristretto.ZERO)),
        proof: realShare.proof,
        submittedAt: new Date().toISOString(),
      },
    };
    const badRes = await app.inject({
      method: 'POST',
      url: '/decryption-shares',
      headers: { authorization: `Bearer ${trusteeTokens[0]}` },
      payload: badShare,
    });
    expect(badRes.statusCode).toBe(400);

    // 17) Admin publishes the final tally — API combines shares off-chain,
    //     solves the small discrete log, and writes the result to the chain.
    const pubRes = await app.inject({
      method: 'POST',
      url: '/results/publish',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { agendaId: agenda.id },
    });
    expect(pubRes.statusCode).toBe(201);
    const tally = pubRes.json() as { results: { optionId: string; count: number }[] };
    const countFor = (id: string) => tally.results.find((r) => r.optionId === id)!.count;
    expect(countFor('alice')).toBe(1);
    expect(countFor('bob')).toBe(0);

    // 18) GET result — the published tally is now publicly fetchable
    const getRes = await app.inject({ method: 'GET', url: `/results/${agenda.id}` });
    expect(getRes.statusCode).toBe(200);
  }, 60_000);
});
