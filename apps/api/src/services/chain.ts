import type { Agenda, Ballot, TallyProof, TrusteeDecryptionShare } from '@ovote/shared';

// CredentialAlreadyUsedError is thrown by ChainGateway.castBallot when a
// blind-signed credential has already been spent on this agenda. Promoted
// to a distinct type so the route layer can map it to HTTP 409 with
// `instanceof` instead of substring-matching the message.
export class CredentialAlreadyUsedError extends Error {
  constructor(message = 'credential already used') {
    super(message);
    this.name = 'CredentialAlreadyUsedError';
  }
}

// ChainGateway abstracts the bulletin board so the API can run against an
// in-memory stub for development/tests or a real Hyperledger Fabric gateway
// in production. Keep this interface tight — these are the only four writes
// that ever touch the chain, plus read-through queries.
export interface ChainGateway {
  createAgenda(agenda: Agenda): Promise<void>;
  openAgenda(agendaId: string): Promise<void>;
  closeAgenda(agendaId: string): Promise<void>;
  castBallot(ballot: Ballot): Promise<void>;
  submitDecryptionShare(share: TrusteeDecryptionShare): Promise<void>;
  publishResult(result: TallyProof): Promise<void>;

  getAgenda(agendaId: string): Promise<Agenda>;
  listAgendas(): Promise<Agenda[]>;
  listBallots(agendaId: string): Promise<Ballot[]>;
  listDecryptionShares(agendaId: string): Promise<TrusteeDecryptionShare[]>;
  getResult(agendaId: string): Promise<TallyProof | null>;
}

export class MemoryChain implements ChainGateway {
  private agendas = new Map<string, Agenda>();
  private ballots = new Map<string, Map<string, Ballot>>();
  private shares = new Map<string, Map<string, TrusteeDecryptionShare>>();
  private results = new Map<string, TallyProof>();

  async createAgenda(agenda: Agenda): Promise<void> {
    if (this.agendas.has(agenda.id)) throw new Error(`agenda ${agenda.id} exists`);
    this.agendas.set(agenda.id, { ...agenda, status: 'draft' });
  }

  async openAgenda(agendaId: string): Promise<void> {
    const a = this.requireAgenda(agendaId);
    if (a.status !== 'draft') throw new Error(`agenda ${agendaId} not draft`);
    a.status = 'open';
  }

  async closeAgenda(agendaId: string): Promise<void> {
    const a = this.requireAgenda(agendaId);
    if (a.status !== 'open') throw new Error(`agenda ${agendaId} not open`);
    a.status = 'closed';
  }

  async castBallot(ballot: Ballot): Promise<void> {
    const a = this.requireAgenda(ballot.agendaId);
    if (a.status !== 'open') throw new Error(`agenda ${a.id} not open`);
    const bag = this.ballots.get(ballot.agendaId) ?? new Map();
    for (const existing of bag.values()) {
      if (existing.credential.signature === ballot.credential.signature) {
        throw new CredentialAlreadyUsedError();
      }
    }
    bag.set(ballot.id, ballot);
    this.ballots.set(ballot.agendaId, bag);
  }

  async submitDecryptionShare(share: TrusteeDecryptionShare): Promise<void> {
    const a = this.requireAgenda(share.agendaId);
    if (a.status !== 'closed') throw new Error(`agenda ${a.id} not closed`);
    const key = `${share.optionId}:${share.trusteeIndex}`;
    const bag = this.shares.get(share.agendaId) ?? new Map();
    if (bag.has(key)) throw new Error(`share already submitted`);
    bag.set(key, share);
    this.shares.set(share.agendaId, bag);
  }

  async publishResult(result: TallyProof): Promise<void> {
    const a = this.requireAgenda(result.agendaId);
    if (a.status !== 'closed') throw new Error(`agenda ${a.id} not closed`);

    // Mirror the chaincode's sanity checks: the result must cover every
    // option exactly once, and each option must have ≥threshold trustee
    // shares on the board. This keeps the two drivers behaviour-identical.
    if (result.results.length !== a.options.length) {
      throw new Error(`tally covers ${result.results.length} options but agenda has ${a.options.length}`);
    }
    const shares = this.shares.get(result.agendaId) ?? new Map();
    const sharesPerOption = new Map<string, Set<number>>();
    for (const s of shares.values()) {
      if (!sharesPerOption.has(s.optionId)) sharesPerOption.set(s.optionId, new Set());
      sharesPerOption.get(s.optionId)!.add(s.trusteeIndex);
    }
    const validOptionIds = new Set(a.options.map((o) => o.id));
    const seen = new Set<string>();
    let totalCount = 0;
    for (const r of result.results) {
      if (!validOptionIds.has(r.optionId)) throw new Error(`tally option ${r.optionId} not on agenda`);
      if (seen.has(r.optionId)) throw new Error(`tally repeats option ${r.optionId}`);
      seen.add(r.optionId);
      if (!Number.isInteger(r.count) || r.count < 0) {
        throw new Error(`option ${r.optionId} has invalid count ${r.count}`);
      }
      totalCount += r.count;
      const n = sharesPerOption.get(r.optionId)?.size ?? 0;
      if (n < a.key.threshold) {
        throw new Error(`option ${r.optionId} has ${n} decryption shares, need threshold=${a.key.threshold}`);
      }
    }

    // Sanity cross-check: every ballot encodes exactly one choice (proven per
    // ballot by the sum proof). So ∑ counts must equal the number of ballots
    // cast. This doesn't re-verify decryption on-chain (that would require
    // porting ristretto255 + Schnorr + Lagrange + a small dlog solver to Go —
    // tracked as v2), but it does refuse any tally whose shape contradicts
    // the ballot box and thus catches a compromised admin fabricating totals.
    const ballots = this.ballots.get(result.agendaId) ?? new Map();
    if (totalCount !== ballots.size) {
      throw new Error(`tally counts sum to ${totalCount} but ${ballots.size} ballots were cast`);
    }

    this.results.set(result.agendaId, result);
    a.status = 'tallied';
  }

  async getAgenda(agendaId: string): Promise<Agenda> {
    return this.requireAgenda(agendaId);
  }

  async listAgendas(): Promise<Agenda[]> {
    return [...this.agendas.values()];
  }

  async listBallots(agendaId: string): Promise<Ballot[]> {
    return [...(this.ballots.get(agendaId)?.values() ?? [])];
  }

  async listDecryptionShares(agendaId: string): Promise<TrusteeDecryptionShare[]> {
    return [...(this.shares.get(agendaId)?.values() ?? [])];
  }

  async getResult(agendaId: string): Promise<TallyProof | null> {
    return this.results.get(agendaId) ?? null;
  }

  private requireAgenda(id: string): Agenda {
    const a = this.agendas.get(id);
    if (!a) throw new Error(`agenda ${id} not found`);
    return a;
  }
}
