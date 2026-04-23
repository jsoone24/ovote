export type Uuid = string;
export type AgendaId = string;
export type B64Url = string;
export type IsoDateTime = string;

export type AgendaStatus = 'draft' | 'open' | 'closed' | 'tallied';

export interface AgendaOption {
  id: string;
  label: string;
}

export interface TrusteePublicShare {
  index: number;
  pk: B64Url;
}

export interface AgendaKey {
  groupPk: B64Url;
  threshold: number;
  n: number;
  trustees: TrusteePublicShare[];
}

export interface Agenda {
  id: AgendaId;
  title: string;
  description: string;
  status: AgendaStatus;
  openAt: IsoDateTime;
  closeAt: IsoDateTime;
  options: AgendaOption[];
  key: AgendaKey;
  registrarBlindPk: B64Url;
  createdBy: string;
  createdAt: IsoDateTime;
}

export interface Ciphertext {
  c1: B64Url;
  c2: B64Url;
}

export interface DisjunctiveProofPart {
  challenge: B64Url;
  response: B64Url;
  commitmentA: B64Url;
  commitmentB: B64Url;
}

export interface BallotOptionCiphertext {
  optionId: string;
  ciphertext: Ciphertext;
  proof: DisjunctiveProofPart[];
}

export interface BallotCredential {
  nonce: B64Url;
  signature: B64Url;
}

export interface Ballot {
  id: Uuid;
  agendaId: AgendaId;
  options: BallotOptionCiphertext[];
  credential: BallotCredential;
  castAt: IsoDateTime;
  transcript: string;
}

export interface SchnorrProof {
  commitment: string;
  response: B64Url;
}

export interface TrusteeDecryptionShare {
  agendaId: AgendaId;
  optionId: string;
  trusteeIndex: number;
  share: B64Url;
  proof: SchnorrProof;
  submittedAt: IsoDateTime;
}

export interface OptionResult {
  optionId: string;
  count: number;
}

export interface TallyProof {
  agendaId: AgendaId;
  results: OptionResult[];
  publishedAt: IsoDateTime;
}
