package main

// JSON shapes on this contract mirror the TypeScript types in packages/shared.
// Field names MUST stay in sync; see packages/shared/src/domain.ts.

type AgendaStatus string

const (
	StatusDraft   AgendaStatus = "draft"
	StatusOpen    AgendaStatus = "open"
	StatusClosed  AgendaStatus = "closed"
	StatusTallied AgendaStatus = "tallied"
)

type AgendaOption struct {
	Id    string `json:"id"`
	Label string `json:"label"`
}

type TrusteePublicShare struct {
	Index int    `json:"index"`
	Pk    string `json:"pk"`
}

type AgendaKey struct {
	GroupPk   string               `json:"groupPk"`
	Threshold int                  `json:"threshold"`
	N         int                  `json:"n"`
	Trustees  []TrusteePublicShare `json:"trustees"`
}

type Agenda struct {
	Id               string         `json:"id"`
	Title            string         `json:"title"`
	Description      string         `json:"description"`
	Status           AgendaStatus   `json:"status"`
	OpenAt           string         `json:"openAt"`
	CloseAt          string         `json:"closeAt"`
	Options          []AgendaOption `json:"options"`
	Key              AgendaKey      `json:"key"`
	RegistrarBlindPk string         `json:"registrarBlindPk"`
	CreatedBy        string         `json:"createdBy"`
	CreatedAt        string         `json:"createdAt"`
}

type Ciphertext struct {
	C1 string `json:"c1"`
	C2 string `json:"c2"`
}

type DisjunctiveProofPart struct {
	Challenge   string `json:"challenge"`
	Response    string `json:"response"`
	CommitmentA string `json:"commitmentA"`
	CommitmentB string `json:"commitmentB"`
}

type BallotOptionCiphertext struct {
	OptionId   string                 `json:"optionId"`
	Ciphertext Ciphertext             `json:"ciphertext"`
	Proof      []DisjunctiveProofPart `json:"proof"`
}

type BallotCredential struct {
	Nonce     string `json:"nonce"`
	Signature string `json:"signature"`
}

type SchnorrProof struct {
	Commitment string `json:"commitment"`
	Response   string `json:"response"`
}

type Ballot struct {
	Id         string                   `json:"id"`
	AgendaId   string                   `json:"agendaId"`
	Options    []BallotOptionCiphertext `json:"options"`
	SumProof   SchnorrProof             `json:"sumProof"`
	Credential BallotCredential         `json:"credential"`
	CastAt     string                   `json:"castAt"`
	Transcript string                   `json:"transcript"`
}

type TrusteeDecryptionShare struct {
	AgendaId     string       `json:"agendaId"`
	OptionId     string       `json:"optionId"`
	TrusteeIndex int          `json:"trusteeIndex"`
	Share        string       `json:"share"`
	Proof        SchnorrProof `json:"proof"`
	SubmittedAt  string       `json:"submittedAt"`
}

type OptionResult struct {
	OptionId string `json:"optionId"`
	Count    int    `json:"count"`
}

type TallyProof struct {
	AgendaId    string         `json:"agendaId"`
	Results     []OptionResult `json:"results"`
	PublishedAt string         `json:"publishedAt"`
}
