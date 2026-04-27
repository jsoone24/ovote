// Emit cross-language test vectors for the Go chaincode's crypto package.
//
// Usage: pnpm --filter @ovote/crypto exec tsx scripts/dump-vectors.ts > <out>.json
//
// Anything that depends on byte-level parity between TS @ovote/crypto and the
// Go reimplementation in chaincode/ovote/crypto/ goes here. The Go test loads
// this JSON and asserts the same outputs.
//
// Vectors are deterministic (no randomness) so this file's output is stable;
// regenerate after intentional changes only.

import { writeFileSync } from 'node:fs';
import { argv } from 'node:process';
import { toB64Url } from '@ovote/shared';
import {
  Ristretto,
  Hash,
  Schnorr,
  Threshold,
  ElGamal,
} from '../src/index.js';

interface HashVector {
  domain: string;
  parts: string[]; // base64url
  scalar: string; // base64url, 32 bytes LE
}

interface SchnorrVector {
  domain: string;
  g1: string;
  h1: string;
  g2: string;
  h2: string;
  proof: { commitment: string; response: string };
  expectedValid: boolean;
}

interface LagrangeVector {
  index: number;
  allIndices: number[];
  coefficient: string; // base64url scalar
}

interface ThresholdEndToEndVector {
  // Two-of-three trustees decrypt an aggregate ciphertext that encrypts m=3.
  threshold: number;
  trustees: { index: number; pk: string }[];
  groupPk: string;
  aggregate: { c1: string; c2: string };
  // The shares each trustee submits (we'll include all 3, the Go side picks 2).
  shares: {
    index: number;
    share: string;
    proof: { commitment: string; response: string };
  }[];
  expectedM: number;
}

const hashVectors: HashVector[] = [];
const schnorrVectors: SchnorrVector[] = [];
const lagrangeVectors: LagrangeVector[] = [];
let thresholdVector: ThresholdEndToEndVector;

// 1. hashToScalar — fixed inputs, expected scalar bytes.
{
  const cases: { domain: string; partsHex: string[] }[] = [
    { domain: 'test', partsHex: [] },
    { domain: 'test', partsHex: ['00'] },
    { domain: 'test', partsHex: ['ffffffff'] },
    { domain: 'ballot-sum:agenda-1', partsHex: ['01020304', 'aabbccdd'] },
    { domain: 'trustee-decrypt', partsHex: ['00'.repeat(32), 'ff'.repeat(32)] },
  ];
  for (const c of cases) {
    const parts = c.partsHex.map((h) => Uint8Array.from(Buffer.from(h, 'hex')));
    const s = Hash.hashToScalar(c.domain, parts);
    hashVectors.push({
      domain: c.domain,
      parts: parts.map((p) => toB64Url(p)),
      scalar: Ristretto.scalarToB64Url(s),
    });
  }
}

// 2. Schnorr equality-of-DLogs — generate two known proofs (one valid, one
//    we tamper with) so the Go verifier can confirm both verdicts.
{
  // Deterministic scalar via hashToScalar so the vector is stable.
  const x = Hash.hashToScalar('test:secret', [Uint8Array.from([1, 2, 3])]);
  const g1 = Ristretto.BASE;
  const h1 = Ristretto.basePointMul(x); // pk = x*G
  // Use another deterministic point for g2.
  const g2Scalar = Hash.hashToScalar('test:g2', [Uint8Array.from([7])]);
  const g2 = Ristretto.basePointMul(g2Scalar);
  const h2 = Ristretto.pointMul(g2, x);

  const proof = Schnorr.proveEqualityOfDiscreteLogs({
    domain: 'parity-test',
    x,
    g1,
    h1,
    g2,
    h2,
  });
  schnorrVectors.push({
    domain: 'parity-test',
    g1: Ristretto.pointToB64Url(g1),
    h1: Ristretto.pointToB64Url(h1),
    g2: Ristretto.pointToB64Url(g2),
    h2: Ristretto.pointToB64Url(h2),
    proof,
    expectedValid: true,
  });

  // Tamper: replace h2 with a different point. Verifier must say invalid.
  const wrongH2 = Ristretto.pointAdd(h2, Ristretto.BASE);
  schnorrVectors.push({
    domain: 'parity-test',
    g1: Ristretto.pointToB64Url(g1),
    h1: Ristretto.pointToB64Url(h1),
    g2: Ristretto.pointToB64Url(g2),
    h2: Ristretto.pointToB64Url(wrongH2),
    proof,
    expectedValid: false,
  });
}

// 3. Lagrange coefficients at x=0 for various index sets.
{
  const cases: { index: number; allIndices: number[] }[] = [
    { index: 1, allIndices: [1, 2] },
    { index: 2, allIndices: [1, 2] },
    { index: 1, allIndices: [1, 2, 3] },
    { index: 2, allIndices: [1, 2, 3] },
    { index: 3, allIndices: [1, 2, 3] },
    { index: 2, allIndices: [2, 4, 5] }, // arbitrary non-contiguous indices
  ];
  for (const c of cases) {
    const lambda = Threshold.lagrangeCoefficient(c.index, c.allIndices);
    lagrangeVectors.push({
      index: c.index,
      allIndices: c.allIndices,
      coefficient: Ristretto.scalarToB64Url(lambda),
    });
  }
}

// 4. End-to-end threshold decryption vector. Builds a 2-of-3 trustee setup,
//    encrypts m=3, has each trustee partial-decrypt the aggregate, and
//    publishes the data the Go side needs to: (a) verify each share's proof,
//    (b) Lagrange-combine, (c) solve dlog to recover m=3.
{
  const dealer = Threshold.trustedDealerKeygen(2, 3);
  const m = 3;
  // Encrypt m*G with deterministic randomness via hashToScalar (so the
  // vector stays stable — encryption is normally randomized).
  const r = Hash.hashToScalar('test:enc-rand', [Uint8Array.from([m])]);
  const c1 = Ristretto.basePointMul(r);
  const c2 = Ristretto.pointAdd(
    Ristretto.basePointMul(BigInt(m)),
    Ristretto.pointMul(dealer.publicParams.groupPk, r),
  );
  const ct: ElGamal.Ciphertext = { c1, c2 };

  const shares = dealer.shares.map((s) => {
    const ds = Threshold.partialDecrypt(s, ct);
    return ds;
  });

  thresholdVector = {
    threshold: dealer.publicParams.threshold,
    trustees: dealer.publicParams.shares.map((s) => ({
      index: s.index,
      pk: Ristretto.pointToB64Url(s.pk),
    })),
    groupPk: Ristretto.pointToB64Url(dealer.publicParams.groupPk),
    aggregate: {
      c1: Ristretto.pointToB64Url(c1),
      c2: Ristretto.pointToB64Url(c2),
    },
    shares: shares.map((s) => ({
      index: s.index,
      share: Ristretto.pointToB64Url(s.share),
      proof: s.proof,
    })),
    expectedM: m,
  };
}

const output = {
  // Schema version — bump if shape changes so Go test fails loudly.
  version: 1,
  hashToScalar: hashVectors,
  schnorrEqualityOfDLogs: schnorrVectors,
  lagrangeCoefficient: lagrangeVectors,
  thresholdDecryption: thresholdVector!,
};

// Either write to a file (if a path is given) or print to stdout.
const outPath = argv[2];
const json = JSON.stringify(output, null, 2);
if (outPath) {
  writeFileSync(outPath, json);
  console.error(`wrote ${outPath}`);
} else {
  console.log(json);
}
