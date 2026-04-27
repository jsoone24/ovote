package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// Contract is the ovote bulletin-board smart contract. It enforces schema and
// storage invariants (time window, credential uniqueness, caller authority);
// zero-knowledge proof bytes are stored verbatim so auditors can re-verify the
// tally end-to-end with the public @ovote/crypto client library.
type Contract struct {
	contractapi.Contract
}

// ---- Agenda lifecycle ------------------------------------------------------

// CreateAgenda persists a new agenda in `draft` status. Admin-only. The
// caller's MSP id is stamped into `createdBy` for audit; `createdAt` defaults
// to the transaction proposal time if the caller did not supply one.
func (c *Contract) CreateAgenda(ctx contractapi.TransactionContextInterface, agendaJSON string) error {
	if err := requireRole(ctx, roleAdmin); err != nil {
		return err
	}
	var a Agenda
	if err := json.Unmarshal([]byte(agendaJSON), &a); err != nil {
		return fmt.Errorf("decode agenda: %w", err)
	}
	if err := validateAgenda(&a); err != nil {
		return err
	}
	caller, err := callerID(ctx)
	if err != nil {
		return err
	}
	a.CreatedBy = caller
	if a.CreatedAt == "" {
		a.CreatedAt = txTime(ctx)
	}
	a.Status = StatusDraft

	key, err := agendaKey(ctx, a.Id)
	if err != nil {
		return err
	}
	existing, err := ctx.GetStub().GetState(key)
	if err != nil {
		return fmt.Errorf("read agenda: %w", err)
	}
	if existing != nil {
		return fmt.Errorf("agenda %q already exists", a.Id)
	}
	return putJSON(ctx, key, &a)
}

// OpenAgenda transitions an agenda from `draft` to `open`. Admin-only.
// Once open, the eligibility roster (held off-chain by the API) is frozen
// and ballots become acceptable.
func (c *Contract) OpenAgenda(ctx contractapi.TransactionContextInterface, agendaID string) error {
	if err := requireRole(ctx, roleAdmin); err != nil {
		return err
	}
	return c.transitionStatus(ctx, agendaID, StatusDraft, StatusOpen)
}

// CloseAgenda transitions an agenda from `open` to `closed`. Admin-only.
// No further ballots will be accepted; trustees may now begin submitting
// decryption shares.
func (c *Contract) CloseAgenda(ctx contractapi.TransactionContextInterface, agendaID string) error {
	if err := requireRole(ctx, roleAdmin); err != nil {
		return err
	}
	return c.transitionStatus(ctx, agendaID, StatusOpen, StatusClosed)
}

// GetAgenda returns one agenda by id. Public — auditors fetch the agenda
// alongside the ballot box to re-run verification.
func (c *Contract) GetAgenda(ctx contractapi.TransactionContextInterface, agendaID string) (*Agenda, error) {
	return getAgenda(ctx, agendaID)
}

// ListAgendas returns every agenda on the channel, in arbitrary order.
// Public.
func (c *Contract) ListAgendas(ctx contractapi.TransactionContextInterface) ([]*Agenda, error) {
	iter, err := ctx.GetStub().GetStateByPartialCompositeKey(agendaPrefix, []string{})
	if err != nil {
		return nil, err
	}
	defer iter.Close()

	var out []*Agenda
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var a Agenda
		if err := json.Unmarshal(kv.Value, &a); err != nil {
			return nil, err
		}
		out = append(out, &a)
	}
	return out, nil
}

// ---- Ballot submission -----------------------------------------------------

// CastBallot appends a verified ballot to the bulletin board. Registrar-role
// only; the registrar is the API gateway that relays the voter's already-
// verified ballot. Single-use is enforced via a credential nullifier keyed
// by the blind signature: the same signature submitted twice fails the
// second time.
func (c *Contract) CastBallot(ctx contractapi.TransactionContextInterface, ballotJSON string) error {
	if err := requireRole(ctx, roleRegistrar); err != nil {
		return err
	}
	var b Ballot
	if err := json.Unmarshal([]byte(ballotJSON), &b); err != nil {
		return fmt.Errorf("decode ballot: %w", err)
	}
	if err := validateBallot(&b); err != nil {
		return err
	}
	agenda, err := getAgenda(ctx, b.AgendaId)
	if err != nil {
		return err
	}
	if agenda.Status != StatusOpen {
		return fmt.Errorf("agenda %q is not open (status=%s)", agenda.Id, agenda.Status)
	}
	now := txTime(ctx)
	if now < agenda.OpenAt || now >= agenda.CloseAt {
		return fmt.Errorf("ballot submitted outside voting window")
	}
	if err := assertBallotMatchesAgenda(&b, agenda); err != nil {
		return err
	}

	// credential uniqueness (single-use via nullifier keyed by blind signature)
	nk, err := credentialNullifierKey(ctx, b.AgendaId, b.Credential.Signature)
	if err != nil {
		return err
	}
	used, err := ctx.GetStub().GetState(nk)
	if err != nil {
		return fmt.Errorf("read credential nullifier: %w", err)
	}
	if used != nil {
		return fmt.Errorf("credential already used")
	}
	if err := ctx.GetStub().PutState(nk, []byte(b.Id)); err != nil {
		return fmt.Errorf("store credential nullifier: %w", err)
	}

	if b.CastAt == "" {
		b.CastAt = now
	}
	key, err := ballotKey(ctx, b.AgendaId, b.Id)
	if err != nil {
		return err
	}
	existing, err := ctx.GetStub().GetState(key)
	if err != nil {
		return err
	}
	if existing != nil {
		return fmt.Errorf("ballot %q already exists", b.Id)
	}
	return putJSON(ctx, key, &b)
}

// ListBallots returns every ballot for the given agenda. Public — auditors
// download the full box to re-aggregate ciphertexts and re-run the trustee
// proofs off-chain.
func (c *Contract) ListBallots(ctx contractapi.TransactionContextInterface, agendaID string) ([]*Ballot, error) {
	iter, err := ctx.GetStub().GetStateByPartialCompositeKey(ballotPrefix, []string{agendaID})
	if err != nil {
		return nil, err
	}
	defer iter.Close()

	var out []*Ballot
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var b Ballot
		if err := json.Unmarshal(kv.Value, &b); err != nil {
			return nil, err
		}
		out = append(out, &b)
	}
	return out, nil
}

// ---- Trustee decryption + tally -------------------------------------------

// SubmitDecryptionShare records one trustee's partial decryption for one
// option, alongside its Chaum-Pedersen equality-of-DLogs proof. Trustee-
// role only. The chaincode does NOT verify the proof at submission time —
// that happens during PublishResult, so trustees can submit in any order
// without coordination.
//
// The composite key (agendaId, optionId, trusteeIndex) makes duplicate
// submissions a no-op rejection: a trustee that submits twice for the same
// option is told to back off.
func (c *Contract) SubmitDecryptionShare(ctx contractapi.TransactionContextInterface, shareJSON string) error {
	if err := requireRole(ctx, roleTrustee); err != nil {
		return err
	}
	var s TrusteeDecryptionShare
	if err := json.Unmarshal([]byte(shareJSON), &s); err != nil {
		return fmt.Errorf("decode share: %w", err)
	}
	if s.AgendaId == "" || s.OptionId == "" || s.Share == "" || s.Proof.Commitment == "" || s.Proof.Response == "" {
		return fmt.Errorf("decryption share has missing fields")
	}
	agenda, err := getAgenda(ctx, s.AgendaId)
	if err != nil {
		return err
	}
	if agenda.Status != StatusClosed {
		return fmt.Errorf("agenda %q is not closed (status=%s)", agenda.Id, agenda.Status)
	}
	var trustee *TrusteePublicShare
	for i := range agenda.Key.Trustees {
		if agenda.Key.Trustees[i].Index == s.TrusteeIndex {
			trustee = &agenda.Key.Trustees[i]
			break
		}
	}
	if trustee == nil {
		return fmt.Errorf("trustee index %d not registered on agenda", s.TrusteeIndex)
	}
	if !optionExists(agenda, s.OptionId) {
		return fmt.Errorf("option %q not on agenda %q", s.OptionId, agenda.Id)
	}
	if s.SubmittedAt == "" {
		s.SubmittedAt = txTime(ctx)
	}
	key, err := decryptionShareKey(ctx, s.AgendaId, s.OptionId, s.TrusteeIndex)
	if err != nil {
		return err
	}
	existing, err := ctx.GetStub().GetState(key)
	if err != nil {
		return err
	}
	if existing != nil {
		return fmt.Errorf("decryption share already submitted by trustee %d for option %q", s.TrusteeIndex, s.OptionId)
	}
	return putJSON(ctx, key, &s)
}

// ListDecryptionShares returns every submitted share for the given agenda.
// Public.
func (c *Contract) ListDecryptionShares(ctx contractapi.TransactionContextInterface, agendaID string) ([]*TrusteeDecryptionShare, error) {
	iter, err := ctx.GetStub().GetStateByPartialCompositeKey(decryptPrefix, []string{agendaID})
	if err != nil {
		return nil, err
	}
	defer iter.Close()

	var out []*TrusteeDecryptionShare
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var s TrusteeDecryptionShare
		if err := json.Unmarshal(kv.Value, &s); err != nil {
			return nil, err
		}
		out = append(out, &s)
	}
	return out, nil
}

// PublishResult finalises the tally for a closed agenda. Admin-only.
//
// The chaincode does NOT trust the published counts. Before persisting it
// re-derives them from the bulletin board:
//
//  1. Shape sanity — every option appears exactly once, every count is
//     non-negative, declared options match the agenda.
//  2. Quorum — every option has ≥ threshold submitted shares.
//  3. Counts equal `len(ballots)` — every ballot encodes exactly one choice
//     (enforced by the per-ballot sum proof at CastBallot), so the totals
//     must add up.
//  4. Per-option crypto re-verification (`tally_verify.go`):
//     a. Re-aggregate each option's ciphertext across every cast ballot.
//     b. Re-verify each submitted Schnorr equality-of-DLogs proof against
//        the agenda-registered trustee pubkey.
//     c. Lagrange-combine a quorum of valid shares to recover m·G.
//     d. Brute-force the small discrete log (bounded by the ballot count)
//        and confirm m equals the published count.
//
// A compromised admin therefore cannot publish a fabricated tally — the
// chain will refuse any result that doesn't match what the trustees jointly
// decrypted from the bulletin board.
func (c *Contract) PublishResult(ctx contractapi.TransactionContextInterface, resultJSON string) error {
	if err := requireRole(ctx, roleAdmin); err != nil {
		return err
	}
	var r TallyProof
	if err := json.Unmarshal([]byte(resultJSON), &r); err != nil {
		return fmt.Errorf("decode result: %w", err)
	}
	agenda, err := getAgenda(ctx, r.AgendaId)
	if err != nil {
		return err
	}
	if agenda.Status != StatusClosed {
		return fmt.Errorf("agenda %q must be closed before tally (status=%s)", agenda.Id, agenda.Status)
	}

	// Sanity-check the submitted tally against the bulletin board: every
	// option must appear exactly once and be backed by at least threshold
	// trustee decryption shares.
	if len(r.Results) != len(agenda.Options) {
		return fmt.Errorf("tally covers %d options but agenda has %d", len(r.Results), len(agenda.Options))
	}
	shares, err := c.ListDecryptionShares(ctx, agenda.Id)
	if err != nil {
		return fmt.Errorf("load decryption shares: %w", err)
	}
	sharesByOption := map[string][]*TrusteeDecryptionShare{}
	for _, s := range shares {
		sharesByOption[s.OptionId] = append(sharesByOption[s.OptionId], s)
	}
	seen := map[string]struct{}{}
	totalCount := 0
	for _, res := range r.Results {
		if !optionExists(agenda, res.OptionId) {
			return fmt.Errorf("tally option %q not on agenda", res.OptionId)
		}
		if _, dup := seen[res.OptionId]; dup {
			return fmt.Errorf("tally repeats option %q", res.OptionId)
		}
		seen[res.OptionId] = struct{}{}
		if res.Count < 0 {
			return fmt.Errorf("tally count for %q is negative", res.OptionId)
		}
		totalCount += res.Count
		if len(sharesByOption[res.OptionId]) < agenda.Key.Threshold {
			return fmt.Errorf("option %q has %d decryption shares, need threshold=%d",
				res.OptionId, len(sharesByOption[res.OptionId]), agenda.Key.Threshold)
		}
	}

	// Every ballot encodes exactly one choice (enforced per-ballot by the
	// sum proof at CastBallot). So the submitted counts must sum to the number
	// of ballots on the board — refuses any tally whose shape contradicts the
	// bulletin board even before the per-option crypto verification below.
	ballots, err := c.ListBallots(ctx, agenda.Id)
	if err != nil {
		return fmt.Errorf("load ballots: %w", err)
	}
	if totalCount != len(ballots) {
		return fmt.Errorf("tally counts sum to %d but %d ballots were cast", totalCount, len(ballots))
	}

	// Full per-option crypto verification. For each option we:
	//   1. Compute the homomorphic aggregate ciphertext (sum of every ballot's
	//      ciphertext for this option). This is what the trustees decrypted.
	//   2. Re-verify each submitted Schnorr equality-of-DLogs proof against the
	//      aggregate (g1=BASE, h1=trustee.pk, g2=aggregate.c1, h2=share).
	//   3. Lagrange-combine the first `threshold` valid shares to recover m*G.
	//   4. Solve the small discrete log: find m in [0..ballotCount] such that
	//      m*G == recovered point. Compare to the published count.
	// This is the on-chain equivalent of the auditor's TS-side recomputation.
	// The crypto package is byte-parity-tested against @ovote/crypto
	// (chaincode/ovote/crypto/crypto_test.go) so any drift fails the build.
	if err := verifyPublishedTally(agenda, r.Results, ballots, sharesByOption); err != nil {
		return fmt.Errorf("tally crypto verification failed: %w", err)
	}

	if r.PublishedAt == "" {
		r.PublishedAt = txTime(ctx)
	}
	key, err := resultKey(ctx, agenda.Id)
	if err != nil {
		return err
	}
	if err := putJSON(ctx, key, &r); err != nil {
		return err
	}

	agenda.Status = StatusTallied
	akey, _ := agendaKey(ctx, agenda.Id)
	return putJSON(ctx, akey, agenda)
}

// GetResult returns the published tally for an agenda, or an error if
// PublishResult has not yet succeeded for it. Public.
func (c *Contract) GetResult(ctx contractapi.TransactionContextInterface, agendaID string) (*TallyProof, error) {
	key, err := resultKey(ctx, agendaID)
	if err != nil {
		return nil, err
	}
	data, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, fmt.Errorf("no result for agenda %q", agendaID)
	}
	var r TallyProof
	if err := json.Unmarshal(data, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

// ---- helpers ---------------------------------------------------------------

func (c *Contract) transitionStatus(ctx contractapi.TransactionContextInterface, agendaID string, from, to AgendaStatus) error {
	a, err := getAgenda(ctx, agendaID)
	if err != nil {
		return err
	}
	if a.Status != from {
		return fmt.Errorf("agenda %q is %s, cannot transition to %s", a.Id, a.Status, to)
	}
	a.Status = to
	key, _ := agendaKey(ctx, agendaID)
	return putJSON(ctx, key, a)
}

func getAgenda(ctx contractapi.TransactionContextInterface, agendaID string) (*Agenda, error) {
	key, err := agendaKey(ctx, agendaID)
	if err != nil {
		return nil, err
	}
	data, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, fmt.Errorf("agenda %q not found", agendaID)
	}
	var a Agenda
	if err := json.Unmarshal(data, &a); err != nil {
		return nil, err
	}
	return &a, nil
}

func putJSON(ctx contractapi.TransactionContextInterface, key string, v any) error {
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	return ctx.GetStub().PutState(key, data)
}

func txTime(ctx contractapi.TransactionContextInterface) string {
	ts, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return time.Now().UTC().Format(time.RFC3339)
	}
	return ts.AsTime().UTC().Format(time.RFC3339)
}

func optionExists(a *Agenda, optionID string) bool {
	for _, o := range a.Options {
		if o.Id == optionID {
			return true
		}
	}
	return false
}
