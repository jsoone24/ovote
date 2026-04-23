import { describe, expect, it } from 'vitest';
import { add, decrypt, encrypt, keygen, sumCiphertexts, zeroCiphertext } from './elgamal.js';
import { scalarFromUint } from './ristretto.js';

describe('exponential ElGamal', () => {
  it('encrypts and decrypts small integers', () => {
    const { sk, pk } = keygen();
    const { ct } = encrypt(pk, scalarFromUint(7));
    expect(decrypt(sk, ct, 100)).toBe(7);
  });

  it('is homomorphic: D(E(a) + E(b)) = a + b', () => {
    const { sk, pk } = keygen();
    const ea = encrypt(pk, scalarFromUint(3)).ct;
    const eb = encrypt(pk, scalarFromUint(4)).ct;
    expect(decrypt(sk, add(ea, eb), 20)).toBe(7);
  });

  it('sums many ciphertexts correctly (tally-like)', () => {
    const { sk, pk } = keygen();
    const cts = [2, 5, 1, 7, 3].map((v) => encrypt(pk, scalarFromUint(v)).ct);
    const sum = sumCiphertexts(cts);
    expect(decrypt(sk, sum, 50)).toBe(18);
  });

  it('zero ciphertext is identity', () => {
    const { sk, pk } = keygen();
    const e = encrypt(pk, scalarFromUint(9)).ct;
    const sum = add(e, zeroCiphertext());
    expect(decrypt(sk, sum, 20)).toBe(9);
  });
});
