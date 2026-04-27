import {
  BASE,
  ZERO,
  type Point,
  type Scalar,
  basePointMul,
  pointAdd,
  pointMul,
  pointSub,
  pointToB64Url,
  pointFromB64Url,
  pointToBytes,
  randomScalar,
  scalarAdd,
  scalarMul,
  scalarSub,
  scalarToB64Url,
  scalarFromB64Url,
} from './ristretto.js';
import { hashToScalar } from './hash.js';
import type { Ciphertext } from './elgamal.js';

export interface DisjunctivePart {
  challenge: string;
  response: string;
  commitmentA: string;
  commitmentB: string;
}

function fiatShamir(domain: string, pk: Point, ct: Ciphertext, commitments: { A: Point; B: Point }[]): Scalar {
  const parts: Uint8Array[] = [pointToBytes(BASE), pointToBytes(pk), pointToBytes(ct.c1), pointToBytes(ct.c2)];
  for (const { A, B } of commitments) {
    parts.push(pointToBytes(A));
    parts.push(pointToBytes(B));
  }
  return hashToScalar(domain, parts);
}

export interface DisjunctiveProof {
  parts: DisjunctivePart[];
}

export function proveMembership(params: {
  domain: string;
  pk: Point;
  ct: Ciphertext;
  messagePoints: Point[];
  actualIndex: number;
  randomness: Scalar;
}): DisjunctiveProof {
  const { domain, pk, ct, messagePoints, actualIndex, randomness } = params;
  const n = messagePoints.length;
  if (actualIndex < 0 || actualIndex >= n) throw new Error('actualIndex out of range');

  const simulatedChallenges: Scalar[] = new Array(n);
  const simulatedResponses: Scalar[] = new Array(n);
  const commitmentsA: Point[] = new Array(n);
  const commitmentsB: Point[] = new Array(n);

  for (let i = 0; i < n; i++) {
    if (i === actualIndex) continue;
    const ci = randomScalar();
    const si = randomScalar();
    const mi = messagePoints[i]!;
    const Ai = pointSub(basePointMul(si), pointMul(ct.c1, ci));
    const Bi = pointSub(pointMul(pk, si), pointMul(pointSub(ct.c2, mi), ci));
    simulatedChallenges[i] = ci;
    simulatedResponses[i] = si;
    commitmentsA[i] = Ai;
    commitmentsB[i] = Bi;
  }

  const w = randomScalar();
  commitmentsA[actualIndex] = basePointMul(w);
  commitmentsB[actualIndex] = pointMul(pk, w);

  const commitmentsPairs = commitmentsA.map((A, i) => ({ A, B: commitmentsB[i]! }));
  const c = fiatShamir(domain, pk, ct, commitmentsPairs);

  let sumOthers = 0n;
  for (let i = 0; i < n; i++) if (i !== actualIndex) sumOthers = scalarAdd(sumOthers, simulatedChallenges[i]!);
  const cActual = scalarSub(c, sumOthers);
  const sActual = scalarAdd(w, scalarMul(cActual, randomness));
  simulatedChallenges[actualIndex] = cActual;
  simulatedResponses[actualIndex] = sActual;

  const parts: DisjunctivePart[] = [];
  for (let i = 0; i < n; i++) {
    parts.push({
      challenge: scalarToB64Url(simulatedChallenges[i]!),
      response: scalarToB64Url(simulatedResponses[i]!),
      commitmentA: pointToB64Url(commitmentsA[i]!),
      commitmentB: pointToB64Url(commitmentsB[i]!),
    });
  }
  return { parts };
}

export function verifyMembership(params: {
  domain: string;
  pk: Point;
  ct: Ciphertext;
  messagePoints: Point[];
  proof: DisjunctiveProof;
}): boolean {
  const { domain, pk, ct, messagePoints, proof } = params;
  const n = messagePoints.length;
  if (proof.parts.length !== n) return false;

  const commitmentsPairs: { A: Point; B: Point }[] = [];
  let sumChallenges = 0n;
  for (let i = 0; i < n; i++) {
    const part = proof.parts[i]!;
    const ci = scalarFromB64Url(part.challenge);
    const si = scalarFromB64Url(part.response);
    const A = pointFromB64Url(part.commitmentA);
    const B = pointFromB64Url(part.commitmentB);
    const mi = messagePoints[i]!;

    const lhsA = basePointMul(si);
    const rhsA = pointAdd(A, pointMul(ct.c1, ci));
    if (!lhsA.equals(rhsA)) return false;

    const lhsB = pointMul(pk, si);
    const rhsB = pointAdd(B, pointMul(pointSub(ct.c2, mi), ci));
    if (!lhsB.equals(rhsB)) return false;

    commitmentsPairs.push({ A, B });
    sumChallenges = scalarAdd(sumChallenges, ci);
  }

  const c = fiatShamir(domain, pk, ct, commitmentsPairs);
  return c === sumChallenges;
}

// Message points for a single 0-or-1 ballot option: {0·G, 1·G} = {ZERO, BASE}.
// The disjunctive proof checks the option's plaintext is one of these.
export function zeroOrOneMessagePoints(): Point[] {
  return [ZERO, BASE];
}
