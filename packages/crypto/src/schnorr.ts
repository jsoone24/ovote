// Non-interactive Schnorr proofs over Ristretto255, in two flavours:
//   * proveKnowledgeOfDiscreteLog — "I know x s.t. pk = x·G"
//   * proveEqualityOfDiscreteLogs — "I know x s.t. h1 = x·g1 AND h2 = x·g2"
//                                    (Chaum-Pedersen)
//
// Both use Fiat-Shamir with the project's domain-separated hash; the
// `domain` parameter MUST uniquely identify the protocol (e.g.
// "ballot-sum:<agendaId>", "trustee-decrypt") to avoid cross-protocol
// challenge reuse. The `extra` parameter binds an additional context blob
// (a transcript hash, an agenda ID, …) into the challenge.
//
// Both verifiers are mirrored byte-for-byte by the Go chaincode in
// `chaincode/ovote/crypto/schnorr.go` so the chain can re-run any proof a
// voter or trustee submitted.

import {
  BASE,
  type Point,
  type Scalar,
  basePointMul,
  pointAdd,
  pointMul,
  pointToB64Url,
  pointFromB64Url,
  pointToBytes,
  randomScalar,
  scalarAdd,
  scalarMul,
  scalarToB64Url,
  scalarFromB64Url,
} from './ristretto.js';
import { hashToScalar } from './hash.js';

/**
 * Wire format for a Schnorr proof.
 *
 * For `proveKnowledgeOfDiscreteLog` the commitment is a single base64url
 * point `R`. For `proveEqualityOfDiscreteLogs` it is `"A.B"` — two base64url
 * points joined by a dot, since the Chaum-Pedersen prover commits to two
 * points (one per generator).
 */
export interface SchnorrProof {
  commitment: string;
  response: string;
}

/**
 * Prove knowledge of `sk` such that `pk = sk·G`. Returns a non-interactive
 * Schnorr signature-of-knowledge bound to `domain` (and `extra` if given).
 */
export function proveKnowledgeOfDiscreteLog(params: {
  domain: string;
  sk: Scalar;
  pk: Point;
  extra?: Uint8Array;
}): SchnorrProof {
  const r = randomScalar();
  const R = basePointMul(r);
  const c = hashToScalar(params.domain, [
    pointToBytes(BASE),
    pointToBytes(params.pk),
    pointToBytes(R),
    ...(params.extra ? [params.extra] : []),
  ]);
  const s = scalarAdd(r, scalarMul(c, params.sk));
  return { commitment: pointToB64Url(R), response: scalarToB64Url(s) };
}

/** Verify a `proveKnowledgeOfDiscreteLog` proof. Returns false on mismatch. */
export function verifyKnowledgeOfDiscreteLog(params: {
  domain: string;
  pk: Point;
  proof: SchnorrProof;
  extra?: Uint8Array;
}): boolean {
  const R = pointFromB64Url(params.proof.commitment);
  const s = scalarFromB64Url(params.proof.response);
  const c = hashToScalar(params.domain, [
    pointToBytes(BASE),
    pointToBytes(params.pk),
    pointToBytes(R),
    ...(params.extra ? [params.extra] : []),
  ]);
  const lhs = basePointMul(s);
  const rhs = pointAdd(R, pointMul(params.pk, c));
  return lhs.equals(rhs);
}

/**
 * Chaum-Pedersen equality-of-DLogs: prove knowledge of `x` such that
 * `h1 = x·g1` AND `h2 = x·g2` simultaneously. Used in two places:
 *
 *   * Trustee partial decryption — proves the share was computed with the
 *     same secret key the trustee committed to in the agenda's pubkey list.
 *   * Ballot sum proof — proves the homomorphic sum of every option's
 *     ciphertext encrypts exactly `1`, ruling out abstention and over-vote
 *     stuffing without revealing which option received the `1`.
 */
export function proveEqualityOfDiscreteLogs(params: {
  domain: string;
  x: Scalar;
  g1: Point;
  h1: Point;
  g2: Point;
  h2: Point;
  extra?: Uint8Array;
}): SchnorrProof {
  const r = randomScalar();
  const A = pointMul(params.g1, r);
  const B = pointMul(params.g2, r);
  const c = hashToScalar(params.domain, [
    pointToBytes(params.g1),
    pointToBytes(params.h1),
    pointToBytes(params.g2),
    pointToBytes(params.h2),
    pointToBytes(A),
    pointToBytes(B),
    ...(params.extra ? [params.extra] : []),
  ]);
  const s = scalarAdd(r, scalarMul(c, params.x));
  return { commitment: pointToB64Url(A) + '.' + pointToB64Url(B), response: scalarToB64Url(s) };
}

/**
 * Verify a `proveEqualityOfDiscreteLogs` proof. Returns false on:
 *   - malformed commitment (wrong number of dots / non-base64url segments)
 *   - challenge mismatch
 *   - either of the two pairwise verification equations failing.
 *
 * NEVER throws on adversarial input — the upstream caller maps "false" to
 * an HTTP 400 / chaincode rejection.
 */
export function verifyEqualityOfDiscreteLogs(params: {
  domain: string;
  g1: Point;
  h1: Point;
  g2: Point;
  h2: Point;
  proof: SchnorrProof;
  extra?: Uint8Array;
}): boolean {
  const parts = params.proof.commitment.split('.');
  if (parts.length !== 2) return false;
  const A = pointFromB64Url(parts[0]!);
  const B = pointFromB64Url(parts[1]!);
  const s = scalarFromB64Url(params.proof.response);
  const c = hashToScalar(params.domain, [
    pointToBytes(params.g1),
    pointToBytes(params.h1),
    pointToBytes(params.g2),
    pointToBytes(params.h2),
    pointToBytes(A),
    pointToBytes(B),
    ...(params.extra ? [params.extra] : []),
  ]);
  const lhsA = pointMul(params.g1, s);
  const rhsA = pointAdd(A, pointMul(params.h1, c));
  const lhsB = pointMul(params.g2, s);
  const rhsB = pointAdd(B, pointMul(params.h2, c));
  return lhsA.equals(rhsA) && lhsB.equals(rhsB);
}
