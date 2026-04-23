import { z } from 'zod';
import type {
  Agenda,
  AgendaKey,
  AgendaOption,
  Ballot,
  BallotCredential,
  BallotOptionCiphertext,
  BlindSignature,
  Ciphertext,
  DisjunctiveProofPart,
  TallyProof,
  TrusteeDecryptionShare,
  TrusteePublicShare,
} from './domain.js';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const B64URL_REGEX = /^[A-Za-z0-9_-]+$/;

export const UuidSchema = z.string().regex(UUID_V4_REGEX, 'expected UUID v4');
export const AgendaIdSchema = UuidSchema;
export const B64UrlSchema = z.string().regex(B64URL_REGEX, 'expected base64url');
export const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const AgendaStatusSchema = z.enum(['draft', 'open', 'closed', 'tallied']);

export const AgendaOptionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
  })
  .strict();

export const TrusteePublicShareSchema = z
  .object({
    index: z.number().int().positive(),
    publicShare: B64UrlSchema,
  })
  .strict();

export const AgendaKeySchema = z
  .object({
    groupPublicKey: B64UrlSchema,
    shares: z.array(TrusteePublicShareSchema).min(1),
    threshold: z.number().int().positive(),
    n: z.number().int().positive(),
  })
  .strict()
  .refine((k) => k.threshold <= k.n, 'threshold must be <= n')
  .refine((k) => k.shares.length === k.n, 'shares length must equal n');

export const AgendaSchema = z
  .object({
    id: AgendaIdSchema,
    title: z.string().min(1),
    description: z.string(),
    options: z.array(AgendaOptionSchema).min(2),
    status: AgendaStatusSchema,
    openAt: IsoDateTimeSchema,
    closeAt: IsoDateTimeSchema,
    key: AgendaKeySchema,
  })
  .strict()
  .refine((a) => new Date(a.openAt).getTime() < new Date(a.closeAt).getTime(), 'openAt must be before closeAt');

export const CiphertextSchema = z
  .object({
    c1: B64UrlSchema,
    c2: B64UrlSchema,
  })
  .strict();

export const DisjunctiveProofPartSchema = z
  .object({
    challenge: B64UrlSchema,
    response: B64UrlSchema,
  })
  .strict();

export const BallotOptionCiphertextSchema = z
  .object({
    optionId: z.string().min(1),
    ct: CiphertextSchema,
    proof: z.array(DisjunctiveProofPartSchema).min(2),
  })
  .strict();

export const BlindSignatureSchema = z
  .object({
    sigma: B64UrlSchema,
  })
  .strict();

export const BallotCredentialSchema = z
  .object({
    token: B64UrlSchema,
    signature: BlindSignatureSchema,
  })
  .strict();

export const BallotSchema = z
  .object({
    agendaId: AgendaIdSchema,
    credential: BallotCredentialSchema,
    ciphertexts: z.array(BallotOptionCiphertextSchema).min(2),
    sumProof: z.array(DisjunctiveProofPartSchema).min(2),
    bucketedTimestamp: IsoDateTimeSchema,
  })
  .strict();

export const TrusteeDecryptionShareSchema = z
  .object({
    index: z.number().int().positive(),
    share: B64UrlSchema,
    proof: DisjunctiveProofPartSchema,
  })
  .strict();

export const TallyProofSchema = z
  .object({
    aggregate: CiphertextSchema,
    decryptionShares: z.array(TrusteeDecryptionShareSchema).min(1),
    plaintext: z.record(z.string().min(1), z.number().int().nonnegative()),
  })
  .strict();

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type InferAgenda = z.infer<typeof AgendaSchema>;
type InferBallot = z.infer<typeof BallotSchema>;
type InferTallyProof = z.infer<typeof TallyProofSchema>;
type InferAgendaKey = z.infer<typeof AgendaKeySchema>;
type InferAgendaOption = z.infer<typeof AgendaOptionSchema>;
type InferCiphertext = z.infer<typeof CiphertextSchema>;
type InferDisjunctiveProofPart = z.infer<typeof DisjunctiveProofPartSchema>;
type InferBallotOptionCiphertext = z.infer<typeof BallotOptionCiphertextSchema>;
type InferBlindSignature = z.infer<typeof BlindSignatureSchema>;
type InferBallotCredential = z.infer<typeof BallotCredentialSchema>;
type InferTrusteePublicShare = z.infer<typeof TrusteePublicShareSchema>;
type InferTrusteeDecryptionShare = z.infer<typeof TrusteeDecryptionShareSchema>;

export type _SchemaShapeChecks = [
  Expect<Equal<InferAgendaOption, AgendaOption>>,
  Expect<Equal<InferCiphertext, Ciphertext>>,
  Expect<Equal<InferDisjunctiveProofPart, DisjunctiveProofPart>>,
  Expect<Equal<InferBallotOptionCiphertext, BallotOptionCiphertext>>,
  Expect<Equal<InferBlindSignature, BlindSignature>>,
  Expect<Equal<InferBallotCredential, BallotCredential>>,
  Expect<Equal<InferTrusteePublicShare, TrusteePublicShare>>,
  Expect<Equal<InferTrusteeDecryptionShare, TrusteeDecryptionShare>>,
  Expect<Equal<InferAgendaKey, AgendaKey>>,
  Expect<Equal<InferAgenda, Agenda>>,
  Expect<Equal<InferBallot, Ballot>>,
  Expect<Equal<InferTallyProof, TallyProof>>,
];

export const parseAgenda = (input: unknown): Agenda => AgendaSchema.parse(input) as Agenda;
export const parseBallot = (input: unknown): Ballot => BallotSchema.parse(input) as Ballot;
export const parseTallyProof = (input: unknown): TallyProof => TallyProofSchema.parse(input) as TallyProof;
