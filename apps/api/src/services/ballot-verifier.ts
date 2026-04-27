import { BlindSignature, Disjunctive, Ristretto, Schnorr } from '@ovote/crypto';
import type { Agenda, Ballot } from '@ovote/shared';
import { fromB64Url } from '@ovote/shared';

// verifyBallot re-runs every zero-knowledge proof the ballot carries so the
// registrar never relays a malformed ballot to the chain. The same logic can
// run in a voter's or auditor's browser using @ovote/crypto — this function is
// just the server-side copy.
export async function verifyBallot(agenda: Agenda, ballot: Ballot): Promise<{ ok: true } | { ok: false; reason: string }> {
  // The public /ballots endpoint is untrusted input. Wrap the whole verifier
  // so that malformed base64url / curve points surface as a validation failure
  // (the caller maps this to 400) instead of leaking as a 500.
  try {
    return await verifyBallotInner(agenda, ballot);
  } catch (err) {
    return { ok: false, reason: `malformed ballot: ${(err as Error).message}` };
  }
}

async function verifyBallotInner(agenda: Agenda, ballot: Ballot): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (ballot.agendaId !== agenda.id) return { ok: false, reason: 'agendaId mismatch' };

  const agendaOptionIds = new Set(agenda.options.map((o) => o.id));
  if (ballot.options.length !== agenda.options.length) {
    return { ok: false, reason: `ballot must cover all ${agenda.options.length} options` };
  }

  const pk = Ristretto.pointFromB64Url(agenda.key.groupPk);
  const zeroOrOne = Disjunctive.zeroOrOneMessagePoints();

  const seen = new Set<string>();
  let sumC1 = Ristretto.ZERO;
  let sumC2 = Ristretto.ZERO;
  for (const opt of ballot.options) {
    if (!agendaOptionIds.has(opt.optionId)) {
      return { ok: false, reason: `unknown option ${opt.optionId}` };
    }
    if (seen.has(opt.optionId)) {
      return { ok: false, reason: `duplicate option ${opt.optionId}` };
    }
    seen.add(opt.optionId);

    const ct = {
      c1: Ristretto.pointFromB64Url(opt.ciphertext.c1),
      c2: Ristretto.pointFromB64Url(opt.ciphertext.c2),
    };

    const proofOk = Disjunctive.verifyMembership({
      domain: 'ballot',
      pk,
      ct,
      messagePoints: zeroOrOne,
      proof: { parts: opt.proof },
    });
    if (!proofOk) {
      return { ok: false, reason: `disjunctive proof failed for option ${opt.optionId}` };
    }

    sumC1 = Ristretto.pointAdd(sumC1, ct.c1);
    sumC2 = Ristretto.pointAdd(sumC2, ct.c2);
  }

  // Each option proves 0-or-1 individually; the sum proof binds them so
  // the voter can't encode all-zero (abstention smuggled past eligibility) or
  // all-one (one ballot casting N votes) ballots. Equality of discrete logs
  // on (sumC1, G) and (sumC2 - G, pk) shows the aggregate encrypts exactly 1.
  const sumC2MinusOne = Ristretto.pointSub(sumC2, Ristretto.basePointMul(1n));
  const sumOk = Schnorr.verifyEqualityOfDiscreteLogs({
    domain: `ballot-sum:${ballot.agendaId}`,
    g1: Ristretto.BASE,
    h1: sumC1,
    g2: pk,
    h2: sumC2MinusOne,
    proof: ballot.sumProof,
  });
  if (!sumOk) {
    return { ok: false, reason: 'ballot sum proof failed (options must sum to exactly 1)' };
  }

  // Verify blind-signed credential. `nonce` carries the already-prepared
  // credential token (voter ran prepare() client-side before blinding; RSABSSA
  // prepare() is randomized, so the server cannot reproduce it). Registrar's
  // public key comes from the agenda record — the chain is the single source
  // of truth for the key.
  const registrarPk = await BlindSignature.importPublicKey(agenda.registrarBlindPk);
  const preparedBytes = fromB64Url(ballot.credential.nonce);
  const sigBytes = fromB64Url(ballot.credential.signature);
  const ok = await BlindSignature.verify(registrarPk, sigBytes, preparedBytes);
  if (!ok) return { ok: false, reason: 'credential signature invalid' };

  return { ok: true };
}
