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

export interface KeyPair {
  sk: Scalar;
  pk: Point;
}

export interface Ciphertext {
  c1: Point;
  c2: Point;
}

export function keygen(): KeyPair {
  const sk = randomScalar();
  const pk = basePointMul(sk);
  return { sk, pk };
}

export function encrypt(pk: Point, messageScalar: Scalar, randomness?: Scalar): { ct: Ciphertext; r: Scalar } {
  const r = randomness ?? randomScalar();
  const c1 = basePointMul(r);
  const c2 = pointAdd(basePointMul(messageScalar), pointMul(pk, r));
  return { ct: { c1, c2 }, r };
}

export function encryptPoint(pk: Point, messagePoint: Point, randomness?: Scalar): { ct: Ciphertext; r: Scalar } {
  const r = randomness ?? randomScalar();
  const c1 = basePointMul(r);
  const c2 = pointAdd(messagePoint, pointMul(pk, r));
  return { ct: { c1, c2 }, r };
}

export function decryptPoint(sk: Scalar, ct: Ciphertext): Point {
  return pointSub(ct.c2, pointMul(ct.c1, sk));
}

export function decrypt(sk: Scalar, ct: Ciphertext, maxValue: number): number {
  const target = decryptPoint(sk, ct);
  return discreteLog(target, maxValue);
}

export function add(a: Ciphertext, b: Ciphertext): Ciphertext {
  return { c1: pointAdd(a.c1, b.c1), c2: pointAdd(a.c2, b.c2) };
}

export function zeroCiphertext(): Ciphertext {
  return { c1: ZERO, c2: ZERO };
}

export function sumCiphertexts(cts: Ciphertext[]): Ciphertext {
  let acc = zeroCiphertext();
  for (const c of cts) acc = add(acc, c);
  return acc;
}

export function discreteLog(target: Point, maxValue: number): number {
  let acc = ZERO;
  if (target.equals(acc)) return 0;
  for (let i = 1; i <= maxValue; i++) {
    acc = pointAdd(acc, BASE);
    if (target.equals(acc)) return i;
  }
  throw new Error(`discrete log exceeds maxValue=${maxValue}`);
}

export function messageToPoint(v: number): Point {
  return basePointMul(scalarFromUint(v));
}
