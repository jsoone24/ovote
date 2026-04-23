import { ristretto255 } from '@noble/curves/ed25519';
import { toB64Url, fromB64Url } from '@ovote/shared';

export type Scalar = bigint;

export interface Point {
  add(other: Point): Point;
  subtract(other: Point): Point;
  negate(): Point;
  multiply(scalar: Scalar): Point;
  equals(other: Point): boolean;
  toBytes(): Uint8Array;
}

const P = ristretto255.Point as unknown as {
  BASE: Point;
  ZERO: Point;
  Fn: {
    ORDER: bigint;
    BYTES: number;
    create(n: bigint): Scalar;
    add(a: Scalar, b: Scalar): Scalar;
    sub(a: Scalar, b: Scalar): Scalar;
    mul(a: Scalar, b: Scalar): Scalar;
    neg(a: Scalar): Scalar;
    inv(a: Scalar): Scalar;
    toBytes(s: Scalar): Uint8Array;
    fromBytes(bytes: Uint8Array): Scalar;
  };
  fromBytes(bytes: Uint8Array): Point;
};
const Fn = P.Fn;

export const ORDER: bigint = Fn.ORDER;
export const SCALAR_SIZE: number = Fn.BYTES;
export const POINT_SIZE = 32;

export const BASE: Point = P.BASE;
export const ZERO: Point = P.ZERO;

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function randomScalar(): Scalar {
  const wide = randomBytes(64);
  let acc = 0n;
  for (const b of wide) acc = (acc << 8n) | BigInt(b);
  return Fn.create(acc);
}

export function scalarFromUint(v: number | bigint): Scalar {
  return Fn.create(typeof v === 'number' ? BigInt(v) : v);
}

export function scalarAdd(a: Scalar, b: Scalar): Scalar {
  return Fn.add(a, b);
}

export function scalarSub(a: Scalar, b: Scalar): Scalar {
  return Fn.sub(a, b);
}

export function scalarMul(a: Scalar, b: Scalar): Scalar {
  return Fn.mul(a, b);
}

export function scalarNeg(a: Scalar): Scalar {
  return Fn.neg(a);
}

export function scalarInv(a: Scalar): Scalar {
  return Fn.inv(a);
}

export function pointAdd(a: Point, b: Point): Point {
  return a.add(b);
}

export function pointSub(a: Point, b: Point): Point {
  return a.subtract(b);
}

export function pointNeg(p: Point): Point {
  return p.negate();
}

export function pointMul(p: Point, s: Scalar): Point {
  const sMod = Fn.create(s);
  if (sMod === 0n) return ZERO;
  return p.multiply(sMod);
}

export function basePointMul(s: Scalar): Point {
  return pointMul(BASE, s);
}

export function pointEquals(a: Point, b: Point): boolean {
  return a.equals(b);
}

export function pointToBytes(p: Point): Uint8Array {
  return p.toBytes();
}

export function pointFromBytes(bytes: Uint8Array): Point {
  if (bytes.length !== POINT_SIZE) throw new Error(`invalid point length: ${bytes.length}`);
  return P.fromBytes(bytes);
}

export function scalarToBytes(s: Scalar): Uint8Array {
  return Fn.toBytes(Fn.create(s));
}

export function scalarFromBytes(bytes: Uint8Array): Scalar {
  if (bytes.length !== SCALAR_SIZE) throw new Error(`invalid scalar length: ${bytes.length}`);
  return Fn.fromBytes(bytes);
}

export function pointToB64Url(p: Point): string {
  return toB64Url(pointToBytes(p));
}

export function pointFromB64Url(s: string): Point {
  return pointFromBytes(fromB64Url(s));
}

export function scalarToB64Url(s: Scalar): string {
  return toB64Url(scalarToBytes(s));
}

export function scalarFromB64Url(s: string): Scalar {
  return scalarFromBytes(fromB64Url(s));
}
