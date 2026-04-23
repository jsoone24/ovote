import { describe, it, expect } from 'vitest';
import { AgendaSchema, BallotSchema, TallyProofSchema } from './schemas.js';

const validAgenda = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Test',
  description: 'A test agenda',
  options: [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' },
  ],
  status: 'open' as const,
  openAt: '2026-04-01T00:00:00Z',
  closeAt: '2026-04-30T00:00:00Z',
  key: {
    groupPublicKey: 'AAAA',
    threshold: 3,
    n: 5,
    shares: [
      { index: 1, publicShare: 'AQID' },
      { index: 2, publicShare: 'AQIE' },
      { index: 3, publicShare: 'AQIF' },
      { index: 4, publicShare: 'AQIG' },
      { index: 5, publicShare: 'AQIH' },
    ],
  },
};

const validBallot = {
  agendaId: '11111111-1111-4111-8111-111111111111',
  credential: {
    token: 'dG9rZW4',
    signature: { sigma: 'c2ln' },
  },
  ciphertexts: [
    {
      optionId: 'yes',
      ct: { c1: 'AAAA', c2: 'BBBB' },
      proof: [
        { challenge: 'CCCC', response: 'DDDD' },
        { challenge: 'EEEE', response: 'FFFF' },
      ],
    },
    {
      optionId: 'no',
      ct: { c1: 'GGGG', c2: 'HHHH' },
      proof: [
        { challenge: 'IIII', response: 'JJJJ' },
        { challenge: 'KKKK', response: 'LLLL' },
      ],
    },
  ],
  sumProof: [
    { challenge: 'MMMM', response: 'NNNN' },
    { challenge: 'OOOO', response: 'PPPP' },
  ],
  bucketedTimestamp: '2026-04-15T12:00:00Z',
};

const validTallyProof = {
  aggregate: { c1: 'AAAA', c2: 'BBBB' },
  decryptionShares: [
    { index: 1, share: 'c2hh', proof: { challenge: 'cDE', response: 'cjE' } },
    { index: 2, share: 'c2hi', proof: { challenge: 'cDI', response: 'cjI' } },
    { index: 3, share: 'c2hj', proof: { challenge: 'cDM', response: 'cjM' } },
  ],
  plaintext: { yes: 42, no: 13 },
};

describe('AgendaSchema', () => {
  it('parses a valid agenda', () => {
    expect(() => AgendaSchema.parse(validAgenda)).not.toThrow();
  });

  it('rejects when threshold exceeds n', () => {
    const bad = structuredClone(validAgenda);
    bad.key.threshold = 6;
    expect(AgendaSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects when shares length does not match n', () => {
    const bad = structuredClone(validAgenda);
    bad.key.n = 6;
    expect(AgendaSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects when openAt is after closeAt', () => {
    const bad = structuredClone(validAgenda);
    bad.openAt = '2026-05-01T00:00:00Z';
    expect(AgendaSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects extra keys', () => {
    const bad: Record<string, unknown> = { ...validAgenda, extra: 'x' };
    expect(AgendaSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects malformed UUID', () => {
    const bad = structuredClone(validAgenda);
    bad.id = 'not-a-uuid';
    expect(AgendaSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects malformed base64url', () => {
    const bad = structuredClone(validAgenda);
    bad.key.groupPublicKey = 'has+plus';
    expect(AgendaSchema.safeParse(bad).success).toBe(false);
  });

  it('requires at least two options', () => {
    const bad = structuredClone(validAgenda);
    bad.options = [bad.options[0]!];
    expect(AgendaSchema.safeParse(bad).success).toBe(false);
  });
});

describe('BallotSchema', () => {
  it('parses a valid ballot', () => {
    expect(() => BallotSchema.parse(validBallot)).not.toThrow();
  });

  it('rejects missing credential signature', () => {
    const bad = structuredClone(validBallot);
    delete (bad.credential as Partial<typeof bad.credential>).signature;
    expect(BallotSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects ciphertext count < 2', () => {
    const bad = structuredClone(validBallot);
    bad.ciphertexts = [bad.ciphertexts[0]!];
    expect(BallotSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects extra keys', () => {
    const bad: Record<string, unknown> = { ...validBallot, extra: 'x' };
    expect(BallotSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects malformed timestamp', () => {
    const bad = structuredClone(validBallot);
    bad.bucketedTimestamp = 'April 15, 2026';
    expect(BallotSchema.safeParse(bad).success).toBe(false);
  });
});

describe('TallyProofSchema', () => {
  it('parses a valid tally proof', () => {
    expect(() => TallyProofSchema.parse(validTallyProof)).not.toThrow();
  });

  it('rejects negative plaintext counts', () => {
    const bad = structuredClone(validTallyProof);
    bad.plaintext.yes = -1;
    expect(TallyProofSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects non-integer plaintext counts', () => {
    const bad = structuredClone(validTallyProof);
    bad.plaintext.yes = 1.5;
    expect(TallyProofSchema.safeParse(bad).success).toBe(false);
  });
});
