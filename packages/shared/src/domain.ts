// Wire-format types for the entire system. These are the single source of
// truth for what the API, the web client, and the Fabric chaincode all
// agree the JSON looks like.
//
// Every type here has a matching strict Zod schema in `schemas.ts`; the
// `Equal<>`/`Expect<>` assertions at the bottom of that file fail the
// build if the runtime validator and the compile-time type drift apart.

/** RFC 4122 v4 UUID, lowercase hex with dashes. */
export type Uuid = string;

/** Same shape as Uuid, but used in the API surface to make agenda IDs grep-able. */
export type AgendaId = string;

/** Base64url-encoded raw bytes (no padding, URL-safe alphabet). */
export type B64Url = string;

/** ISO-8601 / RFC 3339 timestamp string, e.g. "2026-05-01T09:00:00Z". */
export type IsoDateTime = string;

/**
 * Agenda lifecycle:
 *   draft   — created, eligibility roster editable, key & options pinned
 *   open    — accepting ballots; eligibility frozen
 *   closed  — voting window over; trustees may submit decryption shares
 *   tallied — admin published the result; immutable
 */
export type AgendaStatus = 'draft' | 'open' | 'closed' | 'tallied';

/** A ballot choice. `id` matches `option-id-pattern` (kebab-case slug); `label` is display-only. */
export interface AgendaOption {
  id: string;
  label: string;
}

/**
 * Public side of one trustee's threshold key share.
 *
 * `index` is the Shamir x-coordinate (>= 1) — used for Lagrange recombination.
 * `pk` is `sk·G` so anyone can verify the trustee's partial decryption proof.
 */
export interface TrusteePublicShare {
  index: number;
  pk: B64Url;
}

/**
 * Threshold-ElGamal public parameters for an agenda.
 *
 *   groupPk   — the joint public key (= Σ trustee.pk for additive shares)
 *   threshold — minimum trustees needed to decrypt
 *   n         — total trustees
 *   trustees  — public side of each trustee's share, with index for Lagrange
 */
export interface AgendaKey {
  groupPk: B64Url;
  threshold: number;
  n: number;
  trustees: TrusteePublicShare[];
}

/**
 * A voting agenda. The chaincode stores this verbatim; the API and web
 * clients hydrate from it. `registrarBlindPk` is the SPKI-encoded RSA
 * public key voters use to blind-sign credentials specifically for this
 * agenda — credentials are not transferable across agendas.
 */
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

/** ElGamal ciphertext over Ristretto255: `c1 = r·G`, `c2 = m·G + r·pk`. */
export interface Ciphertext {
  c1: B64Url;
  c2: B64Url;
}

/**
 * One leg of a disjunctive (OR) zero-knowledge proof. The full proof is an
 * array — one part per possible plaintext value. Together they prove
 * "ciphertext encrypts one of these values" without revealing which.
 */
export interface DisjunctiveProofPart {
  challenge: B64Url;
  response: B64Url;
  commitmentA: B64Url;
  commitmentB: B64Url;
}

/**
 * One option of a ballot: the encrypted vote (0 or 1) plus the disjunctive
 * proof that the plaintext is in {0·G, 1·G}.
 */
export interface BallotOptionCiphertext {
  optionId: string;
  ciphertext: Ciphertext;
  proof: DisjunctiveProofPart[];
}

/**
 * Voter eligibility credential. `nonce` is the prepared randomized message
 * the voter sent to the registrar; `signature` is the registrar's RSA-BSSA
 * blind signature over it. The pair is single-use — the chaincode keys a
 * nullifier off `signature`.
 */
export interface BallotCredential {
  nonce: B64Url;
  signature: B64Url;
}

/**
 * Wire format for a Schnorr proof. For knowledge-of-DLog `commitment` is
 * a single base64url point. For Chaum-Pedersen equality-of-DLogs it is
 * `"A.B"` — two points joined by a dot.
 */
export interface SchnorrProof {
  commitment: string;
  response: B64Url;
}

/**
 * A complete ballot. `options` carries one entry per agenda option (the
 * client must submit them in canonical order); `sumProof` binds them so
 * the encrypted plaintexts add up to exactly `1`. `credential` proves the
 * voter is eligible without identifying them.
 */
export interface Ballot {
  id: Uuid;
  agendaId: AgendaId;
  options: BallotOptionCiphertext[];
  sumProof: SchnorrProof;
  credential: BallotCredential;
  castAt: IsoDateTime;
  transcript: string;
}

/**
 * One trustee's partial decryption for one option of one closed agenda.
 *
 *   share   — sk_trustee · c1 (the contribution to recovering m·G)
 *   proof   — Chaum-Pedersen proof that `share` was computed with the same
 *             secret key the trustee committed to in `Agenda.key.trustees`
 */
export interface TrusteeDecryptionShare {
  agendaId: AgendaId;
  optionId: string;
  trusteeIndex: number;
  share: B64Url;
  proof: SchnorrProof;
  submittedAt: IsoDateTime;
}

/** Final integer count for one option after homomorphic tally + decryption. */
export interface OptionResult {
  optionId: string;
  count: number;
}

/**
 * Published tally. Persisted on chain as the immutable record of an election;
 * the chaincode re-runs the full crypto verification before accepting it
 * (see `chaincode/ovote/tally_verify.go`).
 */
export interface TallyProof {
  agendaId: AgendaId;
  results: OptionResult[];
  publishedAt: IsoDateTime;
}
