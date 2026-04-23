import {
  BASE,
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
  scalarToB64Url,
  scalarFromB64Url,
} from './ristretto.js';
import { hashToScalar } from './hash.js';

export interface SchnorrProof {
  commitment: string;
  response: string;
}

export function proveKnowledgeOfDiscreteLog(params: {
  domain: string;
  sk: Scalar;
  pk: Point;
  extra?: Uint8Array;
}): SchnorrProof {
  const r = randomScalar();
  const R = basePointMul(r);
  const c = hashToScalar(params.domain, [
    pointToBytes(BASE),
    pointToBytes(params.pk),
    pointToBytes(R),
    ...(params.extra ? [params.extra] : []),
  ]);
  const s = scalarAdd(r, scalarMul(c, params.sk));
  return { commitment: pointToB64Url(R), response: scalarToB64Url(s) };
}

export function verifyKnowledgeOfDiscreteLog(params: {
  domain: string;
  pk: Point;
  proof: SchnorrProof;
  extra?: Uint8Array;
}): boolean {
  const R = pointFromB64Url(params.proof.commitment);
  const s = scalarFromB64Url(params.proof.response);
  const c = hashToScalar(params.domain, [
    pointToBytes(BASE),
    pointToBytes(params.pk),
    pointToBytes(R),
    ...(params.extra ? [params.extra] : []),
  ]);
  const lhs = basePointMul(s);
  const rhs = pointAdd(R, pointMul(params.pk, c));
  return lhs.equals(rhs);
}

export function proveEqualityOfDiscreteLogs(params: {
  domain: string;
  x: Scalar;
  g1: Point;
  h1: Point;
  g2: Point;
  h2: Point;
  extra?: Uint8Array;
}): SchnorrProof {
  const r = randomScalar();
  const A = pointMul(params.g1, r);
  const B = pointMul(params.g2, r);
  const c = hashToScalar(params.domain, [
    pointToBytes(params.g1),
    pointToBytes(params.h1),
    pointToBytes(params.g2),
    pointToBytes(params.h2),
    pointToBytes(A),
    pointToBytes(B),
    ...(params.extra ? [params.extra] : []),
  ]);
  const s = scalarAdd(r, scalarMul(c, params.x));
  return { commitment: pointToB64Url(A) + '.' + pointToB64Url(B), response: scalarToB64Url(s) };
}

export function verifyEqualityOfDiscreteLogs(params: {
  domain: string;
  g1: Point;
  h1: Point;
  g2: Point;
  h2: Point;
  proof: SchnorrProof;
  extra?: Uint8Array;
}): boolean {
  const parts = params.proof.commitment.split('.');
  if (parts.length !== 2) return false;
  const A = pointFromB64Url(parts[0]!);
  const B = pointFromB64Url(parts[1]!);
  const s = scalarFromB64Url(params.proof.response);
  const c = hashToScalar(params.domain, [
    pointToBytes(params.g1),
    pointToBytes(params.h1),
    pointToBytes(params.g2),
    pointToBytes(params.h2),
    pointToBytes(A),
    pointToBytes(B),
    ...(params.extra ? [params.extra] : []),
  ]);
  const lhsA = pointMul(params.g1, s);
  const rhsA = pointAdd(A, pointMul(params.h1, c));
  const lhsB = pointMul(params.g2, s);
  const rhsB = pointAdd(B, pointMul(params.h2, c));
  return lhsA.equals(rhsA) && lhsB.equals(rhsB);
}

export { pointSub };
