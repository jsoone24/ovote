import { describe, expect, it } from 'vitest';
import { proveMembership, verifyMembership, zeroOrOneMessagePoints } from './disjunctive.js';
import { encryptPoint, keygen } from './elgamal.js';

describe('disjunctive (1-of-n) ZK proof', () => {
  it('prove/verify for actualIndex=0 (zero vote)', () => {
    const { pk } = keygen();
    const pts = zeroOrOneMessagePoints();
    const { ct, r } = encryptPoint(pk, pts[0]!);
    const proof = proveMembership({
      domain: 'ballot',
      pk,
      ct,
      messagePoints: pts,
      actualIndex: 0,
      randomness: r,
    });
    expect(verifyMembership({ domain: 'ballot', pk, ct, messagePoints: pts, proof })).toBe(true);
  });

  it('prove/verify for actualIndex=1 (one vote)', () => {
    const { pk } = keygen();
    const pts = zeroOrOneMessagePoints();
    const { ct, r } = encryptPoint(pk, pts[1]!);
    const proof = proveMembership({
      domain: 'ballot',
      pk,
      ct,
      messagePoints: pts,
      actualIndex: 1,
      randomness: r,
    });
    expect(verifyMembership({ domain: 'ballot', pk, ct, messagePoints: pts, proof })).toBe(true);
  });

  it('rejects proof with wrong domain separator', () => {
    const { pk } = keygen();
    const pts = zeroOrOneMessagePoints();
    const { ct, r } = encryptPoint(pk, pts[1]!);
    const proof = proveMembership({
      domain: 'ballot',
      pk,
      ct,
      messagePoints: pts,
      actualIndex: 1,
      randomness: r,
    });
    expect(verifyMembership({ domain: 'other', pk, ct, messagePoints: pts, proof })).toBe(false);
  });

  it('rejects proof against a ciphertext of a non-member value', () => {
    const { pk } = keygen();
    const pts = zeroOrOneMessagePoints();
    const { ct, r } = encryptPoint(pk, pts[1]!);
    // tamper: build proof claiming index 0 while ciphertext encrypts point 1
    expect(() =>
      proveMembership({
        domain: 'ballot',
        pk,
        ct,
        messagePoints: pts,
        actualIndex: 0,
        randomness: r,
      }),
    ).not.toThrow();
    const fakeProof = proveMembership({
      domain: 'ballot',
      pk,
      ct,
      messagePoints: pts,
      actualIndex: 0,
      randomness: r,
    });
    expect(verifyMembership({ domain: 'ballot', pk, ct, messagePoints: pts, proof: fakeProof })).toBe(false);
  });
});
