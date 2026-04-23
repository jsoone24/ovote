import { BlindSignature, Disjunctive, ElGamal, Ristretto, Schnorr } from '@ovote/crypto';
import { fromB64Url, toB64Url } from '@ovote/shared';
import type { Agenda, Ballot, BallotOptionCiphertext } from '@ovote/shared';
import { api } from '../api.js';

export interface PreparedCredential {
  preparedNonce: Uint8Array;
  signature: Uint8Array;
}

// Step 1: voter generates a random credential token and gets it blind-signed
// by the registrar. The registrar learns nothing about the token value.
export async function obtainCredential(agenda: Agenda): Promise<PreparedCredential> {
  const registrarPk = await BlindSignature.importPublicKey(agenda.registrarBlindPk);

  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const preparedNonce = BlindSignature.prepareMessage(raw);

  const { blindedMsg, inv } = await BlindSignature.blindMessage(registrarPk, preparedNonce);
  const { blindSignature } = await api.blindSign(agenda.id, toB64Url(blindedMsg));
  const blindSig = fromB64Url(blindSignature);

  const signature = await BlindSignature.finalize(registrarPk, preparedNonce, blindSig, inv);
  return { preparedNonce, signature };
}

export interface EncryptedChoice {
  optionId: string;
  chosen: boolean; // local-only; NEVER sent to server
  ct: { c1: Uint8Array; c2: Uint8Array };
  proof: { parts: { challenge: string; response: string; commitmentA: string; commitmentB: string }[] };
  randomness: bigint;
}

// Step 2: encrypt each agenda option as 0/1 and prove membership-in-{0,1}.
// We return the randomness too so the caller can implement Benaloh
// cast-or-challenge: if the voter audits this ballot, we reveal randomness to
// prove the ciphertext decrypts to their intended choice, then discard the
// ballot and re-encrypt fresh.
export function encryptBallot(agenda: Agenda, choiceOptionId: string): EncryptedChoice[] {
  const pk = Ristretto.pointFromB64Url(agenda.key.groupPk);
  const points = Disjunctive.zeroOrOneMessagePoints();
  const out: EncryptedChoice[] = [];
  for (const opt of agenda.options) {
    const chosen = opt.id === choiceOptionId;
    const index = chosen ? 1 : 0;
    const { ct, r } = ElGamal.encryptPoint(pk, points[index]!);
    const proof = Disjunctive.proveMembership({
      domain: 'ballot',
      pk,
      ct,
      messagePoints: points,
      actualIndex: index,
      randomness: r,
    });
    out.push({
      optionId: opt.id,
      chosen,
      ct: { c1: Ristretto.pointToBytes(ct.c1), c2: Ristretto.pointToBytes(ct.c2) },
      proof,
      randomness: r,
    });
  }
  return out;
}

export function buildBallot(
  agenda: Agenda,
  id: string,
  choices: EncryptedChoice[],
  credential: PreparedCredential,
): Ballot {
  const options: BallotOptionCiphertext[] = choices.map((c) => ({
    optionId: c.optionId,
    ciphertext: { c1: toB64Url(c.ct.c1), c2: toB64Url(c.ct.c2) },
    proof: c.proof.parts,
  }));

  // Prove the homomorphic sum of all option ciphertexts encrypts exactly 1,
  // i.e. the voter picked exactly one option. Without this a malicious client
  // could submit all-zero or all-one ballots — each option proof would still
  // pass individually, but the tally would be skewed.
  const sumR = choices.reduce((acc, c) => Ristretto.scalarAdd(acc, c.randomness), 0n);
  const pk = Ristretto.pointFromB64Url(agenda.key.groupPk);
  const sumC1 = choices.reduce<Ristretto.Point>(
    (acc, c) => Ristretto.pointAdd(acc, Ristretto.pointFromBytes(c.ct.c1)),
    Ristretto.ZERO,
  );
  const sumC2 = choices.reduce<Ristretto.Point>(
    (acc, c) => Ristretto.pointAdd(acc, Ristretto.pointFromBytes(c.ct.c2)),
    Ristretto.ZERO,
  );
  const sumC2MinusOne = Ristretto.pointSub(sumC2, Ristretto.basePointMul(1n));
  const sumProof = Schnorr.proveEqualityOfDiscreteLogs({
    domain: `ballot-sum:${agenda.id}`,
    x: sumR,
    g1: Ristretto.BASE,
    h1: sumC1,
    g2: pk,
    h2: sumC2MinusOne,
  });

  return {
    id,
    agendaId: agenda.id,
    options,
    sumProof,
    credential: {
      nonce: toB64Url(credential.preparedNonce),
      signature: toB64Url(credential.signature),
    },
    castAt: new Date().toISOString(),
    transcript: '{}',
  };
}
