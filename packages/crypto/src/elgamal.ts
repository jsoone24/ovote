// Additively-homomorphic ElGamal over Ristretto255.
//
// Plaintexts are *points* (typically m·G for a small integer m), not scalars,
// so the ciphertext space is closed under addition: (E(a) + E(b)) decrypts to
// (a+b)·G. That is what makes a homomorphic tally possible — the chain only
// ever decrypts the per-option SUM of every ballot's ciphertext, never an
// individual ballot.
//
// Security note: encryption is randomized via `randomScalar()`. The optional
// `randomness` parameter is exposed only so the voter UI can do a Benaloh
// challenge — never reuse a randomness across two encryptions.

import {
  BASE,
  ZERO,
  type Point,
  type Scalar,
  basePointMul,
  pointAdd,
  pointMul,
  pointSub,
  randomScalar,
  scalarFromUint,
} from './ristretto.js';

/** A standard ElGamal keypair: pk = sk·G. */
export interface KeyPair {
  sk: Scalar;
  pk: Point;
}

/**
 * Ciphertext for an additively-homomorphic ElGamal encryption.
 * `c1 = r·G`, `c2 = m·G + r·pk`. Decryption recovers `m·G = c2 - sk·c1`.
 */
export interface Ciphertext {
  c1: Point;
  c2: Point;
}

/** Generate a fresh keypair from secure randomness. */
export function keygen(): KeyPair {
  const sk = randomScalar();
  const pk = basePointMul(sk);
  return { sk, pk };
}

/**
 * Encrypt a small integer `messageScalar` (treated as `m·G`) under `pk`.
 * Returns the ciphertext plus the randomness `r` used (so the caller can run
 * a Benaloh audit). If `randomness` is provided, encryption is deterministic
 * — only use this for tests or audit replay.
 */
export function encrypt(pk: Point, messageScalar: Scalar, randomness?: Scalar): { ct: Ciphertext; r: Scalar } {
  const r = randomness ?? randomScalar();
  const c1 = basePointMul(r);
  const c2 = pointAdd(basePointMul(messageScalar), pointMul(pk, r));
  return { ct: { c1, c2 }, r };
}

/**
 * Encrypt an arbitrary `messagePoint` under `pk`. Used when the caller has
 * already constructed the message point (e.g. selecting between known-good
 * ZERO and BASE for a 0-or-1 ballot option).
 */
export function encryptPoint(pk: Point, messagePoint: Point, randomness?: Scalar): { ct: Ciphertext; r: Scalar } {
  const r = randomness ?? randomScalar();
  const c1 = basePointMul(r);
  const c2 = pointAdd(messagePoint, pointMul(pk, r));
  return { ct: { c1, c2 }, r };
}

/** Recover `m·G` from a ciphertext. Linear in 1; the small-dlog step is separate. */
export function decryptPoint(sk: Scalar, ct: Ciphertext): Point {
  return pointSub(ct.c2, pointMul(ct.c1, sk));
}

/**
 * Decrypt a ciphertext to a small integer message in `[0, maxValue]`.
 * Throws if the recovered `m·G` is outside the range — caller MUST pass a
 * tight `maxValue` (e.g. ballot count) to keep the linear search bounded.
 */
export function decrypt(sk: Scalar, ct: Ciphertext, maxValue: number): number {
  const target = decryptPoint(sk, ct);
  return discreteLog(target, maxValue);
}

/** Componentwise addition: E(a) + E(b) decrypts to (a+b). */
export function add(a: Ciphertext, b: Ciphertext): Ciphertext {
  return { c1: pointAdd(a.c1, b.c1), c2: pointAdd(a.c2, b.c2) };
}

/** Identity element of the ciphertext additive group. */
export function zeroCiphertext(): Ciphertext {
  return { c1: ZERO, c2: ZERO };
}

/** Homomorphic sum across a list of ciphertexts; result decrypts to Σ m_i. */
export function sumCiphertexts(cts: Ciphertext[]): Ciphertext {
  let acc = zeroCiphertext();
  for (const c of cts) acc = add(acc, c);
  return acc;
}

/**
 * Linear-search discrete log: find m in `[0, maxValue]` such that `m·G = target`.
 * Used after `decryptPoint` to recover the integer tally. Mirrored byte-for-
 * byte by `chaincode/ovote/crypto/dlog.go` so the chain can reproduce the
 * decoding step on its own.
 */
export function discreteLog(target: Point, maxValue: number): number {
  let acc = ZERO;
  if (target.equals(acc)) return 0;
  for (let i = 1; i <= maxValue; i++) {
    acc = pointAdd(acc, BASE);
    if (target.equals(acc)) return i;
  }
  throw new Error(`discrete log exceeds maxValue=${maxValue}`);
}

/** Convenience: build the message point `v·G` for a small integer `v`. */
export function messageToPoint(v: number): Point {
  return basePointMul(scalarFromUint(v));
}
