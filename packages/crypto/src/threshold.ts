import {
  type Point,
  type Scalar,
  BASE,
  basePointMul,
  pointAdd,
  pointMul,
  pointSub,
  randomScalar,
  scalarAdd,
  scalarInv,
  scalarMul,
  scalarNeg,
  scalarFromUint,
} from './ristretto.js';
import { proveEqualityOfDiscreteLogs, verifyEqualityOfDiscreteLogs, type SchnorrProof } from './schnorr.js';
import type { Ciphertext } from './elgamal.js';

export interface ThresholdKeyShare {
  index: number;
  sk: Scalar;
  pk: Point;
}

export interface ThresholdPublicParams {
  groupPk: Point;
  threshold: number;
  n: number;
  shares: { index: number; pk: Point }[];
}

export interface TrustedDealerOutput {
  publicParams: ThresholdPublicParams;
  shares: ThresholdKeyShare[];
  masterSecret: Scalar;
}

export function trustedDealerKeygen(threshold: number, n: number): TrustedDealerOutput {
  if (threshold < 1 || threshold > n) throw new Error('invalid threshold/n');

  const coeffs: Scalar[] = [];
  for (let i = 0; i < threshold; i++) coeffs.push(randomScalar());
  const masterSecret = coeffs[0]!;

  const shares: ThresholdKeyShare[] = [];
  for (let i = 1; i <= n; i++) {
    const x = scalarFromUint(i);
    let y = 0n;
    for (let j = coeffs.length - 1; j >= 0; j--) y = scalarAdd(scalarMul(y, x), coeffs[j]!);
    shares.push({ index: i, sk: y, pk: basePointMul(y) });
  }

  const publicParams: ThresholdPublicParams = {
    groupPk: basePointMul(masterSecret),
    threshold,
    n,
    shares: shares.map((s) => ({ index: s.index, pk: s.pk })),
  };
  return { publicParams, shares, masterSecret };
}

export function lagrangeCoefficient(indexI: number, allIndices: number[]): Scalar {
  let num: Scalar = scalarFromUint(1);
  let den: Scalar = scalarFromUint(1);
  const xi = scalarFromUint(indexI);
  for (const j of allIndices) {
    if (j === indexI) continue;
    const xj = scalarFromUint(j);
    num = scalarMul(num, scalarNeg(xj));
    den = scalarMul(den, scalarAdd(xi, scalarNeg(xj)));
  }
  return scalarMul(num, scalarInv(den));
}

export interface DecryptionShare {
  index: number;
  share: Point;
  proof: SchnorrProof;
}

export function partialDecrypt(share: ThresholdKeyShare, ct: Ciphertext, domain = 'trustee-decrypt'): DecryptionShare {
  const shareValue = pointMul(ct.c1, share.sk);
  const proof = proveEqualityOfDiscreteLogs({
    domain,
    x: share.sk,
    g1: BASE,
    h1: share.pk,
    g2: ct.c1,
    h2: shareValue,
  });
  return { index: share.index, share: shareValue, proof };
}

export function verifyDecryptionShare(params: {
  shareValue: DecryptionShare;
  trusteePk: Point;
  ct: Ciphertext;
  domain?: string;
}): boolean {
  const domain = params.domain ?? 'trustee-decrypt';
  return verifyEqualityOfDiscreteLogs({
    domain,
    g1: BASE,
    h1: params.trusteePk,
    g2: params.ct.c1,
    h2: params.shareValue.share,
    proof: params.shareValue.proof,
  });
}

export function combineShares(shares: DecryptionShare[], ct: Ciphertext): Point {
  const indices = shares.map((s) => s.index);
  let combined = basePointMul(scalarFromUint(0));
  for (const s of shares) {
    const lambda = lagrangeCoefficient(s.index, indices);
    combined = pointAdd(combined, pointMul(s.share, lambda));
  }
  return pointSub(ct.c2, combined);
}
