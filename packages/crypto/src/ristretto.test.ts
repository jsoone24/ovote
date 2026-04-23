import { describe, expect, it } from 'vitest';
import {
  BASE,
  ZERO,
  ORDER,
  basePointMul,
  pointAdd,
  pointEquals,
  pointFromB64Url,
  pointFromBytes,
  pointNeg,
  pointSub,
  pointToB64Url,
  pointToBytes,
  randomScalar,
  scalarAdd,
  scalarFromB64Url,
  scalarFromBytes,
  scalarFromUint,
  scalarInv,
  scalarMul,
  scalarNeg,
  scalarToB64Url,
  scalarToBytes,
} from './ristretto.js';

describe('ristretto255', () => {
  it('point round-trips via bytes', () => {
    const p = basePointMul(scalarFromUint(12345));
    const bytes = pointToBytes(p);
    const q = pointFromBytes(bytes);
    expect(pointEquals(p, q)).toBe(true);
  });

  it('point round-trips via base64url', () => {
    const p = basePointMul(randomScalar());
    const q = pointFromB64Url(pointToB64Url(p));
    expect(pointEquals(p, q)).toBe(true);
  });

  it('scalar round-trips via bytes and base64url', () => {
    const s = randomScalar();
    expect(scalarFromBytes(scalarToBytes(s))).toBe(s);
    expect(scalarFromB64Url(scalarToB64Url(s))).toBe(s);
  });

  it('point negation: P + (-P) = 0', () => {
    const p = basePointMul(scalarFromUint(42));
    const sum = pointAdd(p, pointNeg(p));
    expect(pointEquals(sum, ZERO)).toBe(true);
  });

  it('scalar inverse: x * x^-1 = 1', () => {
    const x = randomScalar();
    const one = scalarMul(x, scalarInv(x));
    expect(one).toBe(1n);
  });

  it('scalar negation: x + (-x) = 0', () => {
    const x = randomScalar();
    expect(scalarAdd(x, scalarNeg(x))).toBe(0n);
  });

  it('linearity: (a+b)*G = a*G + b*G', () => {
    const a = scalarFromUint(7);
    const b = scalarFromUint(11);
    const lhs = basePointMul(scalarAdd(a, b));
    const rhs = pointAdd(basePointMul(a), basePointMul(b));
    expect(pointEquals(lhs, rhs)).toBe(true);
  });

  it('subtraction: A - B = A + (-B)', () => {
    const a = basePointMul(scalarFromUint(100));
    const b = basePointMul(scalarFromUint(37));
    expect(pointEquals(pointSub(a, b), pointAdd(a, pointNeg(b)))).toBe(true);
  });

  it('ORDER is the curve group order and nonzero', () => {
    expect(ORDER).toBeGreaterThan(0n);
  });

  it('BASE is nonzero', () => {
    expect(pointEquals(BASE, ZERO)).toBe(false);
  });
});
