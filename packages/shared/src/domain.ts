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
  publicShare: B64Url;
}

export interface AgendaKey {
  groupPublicKey: B64Url;
  shares: TrusteePublicShare[];
  threshold: number;
  n: number;
}

export interface Agenda {
  id: AgendaId;
  title: string;
  description: string;
  options: AgendaOption[];
  status: AgendaStatus;
  openAt: IsoDateTime;
  closeAt: IsoDateTime;
  key: AgendaKey;
}

export interface Ciphertext {
  c1: B64Url;
  c2: B64Url;
}

export interface DisjunctiveProofPart {
  challenge: B64Url;
  response: B64Url;
}

export interface BallotOptionCiphertext {
  optionId: string;
  ct: Ciphertext;
  proof: DisjunctiveProofPart[];
}

export interface BlindSignature {
  sigma: B64Url;
}

export interface BallotCredential {
  token: B64Url;
  signature: BlindSignature;
}

export interface Ballot {
  agendaId: AgendaId;
  credential: BallotCredential;
  ciphertexts: BallotOptionCiphertext[];
  sumProof: DisjunctiveProofPart[];
  bucketedTimestamp: IsoDateTime;
}

export interface TrusteeDecryptionShare {
  index: number;
  share: B64Url;
  proof: DisjunctiveProofPart;
}

export interface TallyProof {
  aggregate: Ciphertext;
  decryptionShares: TrusteeDecryptionShare[];
  plaintext: Record<string, number>;
}
