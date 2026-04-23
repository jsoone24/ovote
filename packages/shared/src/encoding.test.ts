import { describe, it, expect } from 'vitest';
import { canonicalJSON, fromB64Url, toB64Url } from './encoding.js';

describe('base64url', () => {
  it('round-trips random bytes', () => {
    for (let len = 0; len < 64; len++) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = (i * 131 + 7) & 0xff;
      const encoded = toB64Url(bytes);
      expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
      const decoded = fromB64Url(encoded);
      expect(decoded).toEqual(bytes);
    }
  });

  it('rejects non-base64url characters', () => {
    expect(() => fromB64Url('abc!def')).toThrow();
    expect(() => fromB64Url('abc=def')).toThrow();
    expect(() => fromB64Url('abc+def')).toThrow();
  });
});

describe('canonicalJSON', () => {
  it('sorts object keys', () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJSON({ z: { y: 1, x: 2 }, a: [] })).toBe('{"a":[],"z":{"x":2,"y":1}}');
  });

  it('is stable under key-order permutation', () => {
    const a = { foo: 1, bar: 2, baz: 3 };
    const b = { baz: 3, bar: 2, foo: 1 };
    expect(canonicalJSON(a)).toBe(canonicalJSON(b));
  });

  it('handles primitives and arrays', () => {
    expect(canonicalJSON(null)).toBe('null');
    expect(canonicalJSON(true)).toBe('true');
    expect(canonicalJSON(false)).toBe('false');
    expect(canonicalJSON(0)).toBe('0');
    expect(canonicalJSON('a')).toBe('"a"');
    expect(canonicalJSON([1, 'two', null])).toBe('[1,"two",null]');
  });

  it('rejects undefined, NaN, Infinity, bigint', () => {
    expect(() => canonicalJSON(undefined)).toThrow();
    expect(() => canonicalJSON(Number.NaN)).toThrow();
    expect(() => canonicalJSON(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => canonicalJSON(1n)).toThrow();
  });

  it('skips undefined values in objects', () => {
    expect(canonicalJSON({ a: 1, b: undefined, c: 2 })).toBe('{"a":1,"c":2}');
  });
});
