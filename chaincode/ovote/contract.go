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

func (c *Contract) OpenAgenda(ctx contractapi.TransactionContextInterface, agendaID string) error {
	if err := requireRole(ctx, roleAdmin); err != nil {
		return err
	}
	return c.transitionStatus(ctx, agendaID, StatusDraft, StatusOpen)
}

func (c *Contract) CloseAgenda(ctx contractapi.TransactionContextInterface, agendaID string) error {
	if err := requireRole(ctx, roleAdmin); err != nil {
		return err
	}
	return c.transitionStatus(ctx, agendaID, StatusOpen, StatusClosed)
}

func (c *Contract) GetAgenda(ctx contractapi.TransactionContextInterface, agendaID string) (*Agenda, error) {
	return getAgenda(ctx, agendaID)
}

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
	// trustee decryption shares. The actual count value is the result of
	// off-chain Lagrange interpolation + small-discrete-log; we cannot
	// re-run the crypto here, but we can ensure the shares exist so an
	// admin can't publish a fabricated result out of thin air.
	if len(r.Results) != len(agenda.Options) {
		return fmt.Errorf("tally covers %d options but agenda has %d", len(r.Results), len(agenda.Options))
	}
	shares, err := c.ListDecryptionShares(ctx, agenda.Id)
	if err != nil {
		return fmt.Errorf("load decryption shares: %w", err)
	}
	sharesPerOption := map[string]map[int]struct{}{}
	for _, s := range shares {
		if sharesPerOption[s.OptionId] == nil {
			sharesPerOption[s.OptionId] = map[int]struct{}{}
		}
		sharesPerOption[s.OptionId][s.TrusteeIndex] = struct{}{}
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
		if len(sharesPerOption[res.OptionId]) < agenda.Key.Threshold {
			return fmt.Errorf("option %q has %d decryption shares, need threshold=%d",
				res.OptionId, len(sharesPerOption[res.OptionId]), agenda.Key.Threshold)
		}
	}

	// Every ballot encodes exactly one choice (enforced per-ballot by the
	// sum proof at CastBallot). So the submitted counts must sum to the number
	// of ballots on the board — a cheap cross-check that refuses any tally
	// whose shape contradicts the bulletin board even though we can't re-run
	// the decryption crypto here.
	ballots, err := c.ListBallots(ctx, agenda.Id)
	if err != nil {
		return fmt.Errorf("load ballots: %w", err)
	}
	if totalCount != len(ballots) {
		return fmt.Errorf("tally counts sum to %d but %d ballots were cast", totalCount, len(ballots))
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
