import { describe, it, expect } from 'vitest';
import { AgendaSchema, BallotSchema, TallyProofSchema } from './schemas.js';

const validAgenda = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Test',
  description: 'A test agenda',
  status: 'open' as const,
  openAt: '2026-04-01T00:00:00Z',
  closeAt: '2026-04-30T00:00:00Z',
  options: [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' },
  ],
  key: {
    groupPk: 'AAAA',
    threshold: 3,
    n: 5,
    trustees: [
      { index: 1, pk: 'AQID' },
      { index: 2, pk: 'AQIE' },
      { index: 3, pk: 'AQIF' },
      { index: 4, pk: 'AQIG' },
      { index: 5, pk: 'AQIH' },
    ],
  },
  registrarBlindPk: 'cGs',
  createdBy: 'x509::CN=admin',
  createdAt: '2026-03-30T00:00:00Z',
};

const validBallot = {
  id: '22222222-2222-4222-8222-222222222222',
  agendaId: '11111111-1111-4111-8111-111111111111',
  options: [
    {
      optionId: 'yes',
      ciphertext: { c1: 'AAAA', c2: 'BBBB' },
      proof: [
        { challenge: 'CCCC', response: 'DDDD', commitmentA: 'aaaa', commitmentB: 'bbbb' },
        { challenge: 'EEEE', response: 'FFFF', commitmentA: 'cccc', commitmentB: 'dddd' },
      ],
    },
    {
      optionId: 'no',
      ciphertext: { c1: 'GGGG', c2: 'HHHH' },
      proof: [
        { challenge: 'IIII', response: 'JJJJ', commitmentA: 'eeee', commitmentB: 'ffff' },
        { challenge: 'KKKK', response: 'LLLL', commitmentA: 'gggg', commitmentB: 'hhhh' },
      ],
    },
  ],
  sumProof: {
    commitment: 'AAAA.BBBB',
    response: 'CCCC',
  },
  credential: {
    nonce: 'bm9uY2U',
    signature: 'c2ln',
  },
  castAt: '2026-04-15T12:00:00Z',
  transcript: '{}',
};

const validTallyProof = {
  agendaId: '11111111-1111-4111-8111-111111111111',
  results: [
    { optionId: 'yes', count: 42 },
    { optionId: 'no', count: 13 },
  ],
  publishedAt: '2026-05-01T00:00:00Z',
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

  it('rejects when trustees length does not match n', () => {
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
    bad.key.groupPk = 'has+plus';
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

  it('rejects option count < 2', () => {
    const bad = structuredClone(validBallot);
    bad.options = [bad.options[0]!];
    expect(BallotSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects extra keys', () => {
    const bad: Record<string, unknown> = { ...validBallot, extra: 'x' };
    expect(BallotSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects malformed timestamp', () => {
    const bad = structuredClone(validBallot);
    bad.castAt = 'April 15, 2026';
    expect(BallotSchema.safeParse(bad).success).toBe(false);
  });
});

describe('TallyProofSchema', () => {
  it('parses a valid tally proof', () => {
    expect(() => TallyProofSchema.parse(validTallyProof)).not.toThrow();
  });

  it('rejects negative counts', () => {
    const bad = structuredClone(validTallyProof);
    bad.results[0]!.count = -1;
    expect(TallyProofSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects non-integer counts', () => {
    const bad = structuredClone(validTallyProof);
    bad.results[0]!.count = 1.5;
    expect(TallyProofSchema.safeParse(bad).success).toBe(false);
  });
});
