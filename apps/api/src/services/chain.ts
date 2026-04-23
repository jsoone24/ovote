import type { Agenda, Ballot, TallyProof, TrusteeDecryptionShare } from '@ovote/shared';

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
        throw new Error('credential already used');
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
