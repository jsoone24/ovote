import { describe, expect, it } from 'vitest';
import {
  proveEqualityOfDiscreteLogs,
  proveKnowledgeOfDiscreteLog,
  verifyEqualityOfDiscreteLogs,
  verifyKnowledgeOfDiscreteLog,
} from './schnorr.js';
import { BASE, basePointMul, pointMul, randomScalar } from './ristretto.js';

describe('Schnorr knowledge of discrete log', () => {
  it('prove/verify round-trip', () => {
    const sk = randomScalar();
    const pk = basePointMul(sk);
    const proof = proveKnowledgeOfDiscreteLog({ domain: 'test', sk, pk });
    expect(verifyKnowledgeOfDiscreteLog({ domain: 'test', pk, proof })).toBe(true);
  });

  it('rejects wrong public key', () => {
    const sk = randomScalar();
    const pk = basePointMul(sk);
    const wrongPk = basePointMul(randomScalar());
    const proof = proveKnowledgeOfDiscreteLog({ domain: 'test', sk, pk });
    expect(verifyKnowledgeOfDiscreteLog({ domain: 'test', pk: wrongPk, proof })).toBe(false);
  });

  it('rejects wrong domain separator', () => {
    const sk = randomScalar();
    const pk = basePointMul(sk);
    const proof = proveKnowledgeOfDiscreteLog({ domain: 'test', sk, pk });
    expect(verifyKnowledgeOfDiscreteLog({ domain: 'other', pk, proof })).toBe(false);
  });
});

describe('Chaum-Pedersen equality of discrete logs', () => {
  it('prove/verify round-trip for shared exponent', () => {
    const x = randomScalar();
    const g1 = BASE;
    const h1 = pointMul(g1, x);
    const g2 = basePointMul(randomScalar());
    const h2 = pointMul(g2, x);
    const proof = proveEqualityOfDiscreteLogs({ domain: 'eq', x, g1, h1, g2, h2 });
    expect(verifyEqualityOfDiscreteLogs({ domain: 'eq', g1, h1, g2, h2, proof })).toBe(true);
  });

  it('rejects mismatched exponents', () => {
    const x = randomScalar();
    const wrong = randomScalar();
    const g1 = BASE;
    const h1 = pointMul(g1, x);
    const g2 = basePointMul(randomScalar());
    const h2 = pointMul(g2, wrong);
    const proof = proveEqualityOfDiscreteLogs({ domain: 'eq', x, g1, h1, g2, h2 });
    expect(verifyEqualityOfDiscreteLogs({ domain: 'eq', g1, h1, g2, h2, proof })).toBe(false);
  });
});
