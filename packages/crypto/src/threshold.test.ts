import { describe, expect, it } from 'vitest';
import {
  combineShares,
  partialDecrypt,
  trustedDealerKeygen,
  verifyDecryptionShare,
} from './threshold.js';
import { add, encrypt, discreteLog } from './elgamal.js';
import { scalarFromUint } from './ristretto.js';

describe('threshold ElGamal (trusted dealer, t-of-n)', () => {
  it('3-of-5 end-to-end: encrypt -> homomorphic add -> partial decrypt -> combine', () => {
    const { publicParams, shares } = trustedDealerKeygen(3, 5);
    const pk = publicParams.groupPk;

    // tally: 2 + 5 + 3 = 10
    const cts = [2, 5, 3].map((v) => encrypt(pk, scalarFromUint(v)).ct);
    let acc = cts[0]!;
    for (let i = 1; i < cts.length; i++) acc = add(acc, cts[i]!);

    const quorum = [shares[0]!, shares[2]!, shares[4]!];
    const decShares = quorum.map((s) => partialDecrypt(s, acc));

    for (const ds of decShares) {
      const trustee = publicParams.shares.find((x) => x.index === ds.index)!;
      const ok = verifyDecryptionShare({
        shareValue: ds,
        trusteePk: trustee.pk,
        ct: acc,
      });
      expect(ok).toBe(true);
    }

    const m = combineShares(decShares, acc);
    expect(discreteLog(m, 50)).toBe(10);
  });

  it('any 3 trustees suffice (different subset)', () => {
    const { publicParams, shares } = trustedDealerKeygen(3, 5);
    const pk = publicParams.groupPk;
    const { ct } = encrypt(pk, scalarFromUint(42));

    const quorum = [shares[1]!, shares[3]!, shares[4]!];
    const decShares = quorum.map((s) => partialDecrypt(s, ct));
    const m = combineShares(decShares, ct);
    expect(discreteLog(m, 100)).toBe(42);
  });

  it('2 trustees cannot reconstruct (below threshold)', () => {
    const { publicParams, shares } = trustedDealerKeygen(3, 5);
    const pk = publicParams.groupPk;
    const { ct } = encrypt(pk, scalarFromUint(7));

    const tooFew = [shares[0]!, shares[1]!];
    const decShares = tooFew.map((s) => partialDecrypt(s, ct));
    const m = combineShares(decShares, ct);
    expect(() => discreteLog(m, 50)).toThrow();
  });

  it('rejects a tampered decryption share', () => {
    const { publicParams, shares } = trustedDealerKeygen(3, 5);
    const { ct } = encrypt(publicParams.groupPk, scalarFromUint(1));
    const ds = partialDecrypt(shares[0]!, ct);
    const wrongPk = publicParams.shares[1]!.pk;
    const ok = verifyDecryptionShare({ shareValue: ds, trusteePk: wrongPk, ct });
    expect(ok).toBe(false);
  });
});
