package main

import (
	"encoding/base64"
	"fmt"
	"regexp"
	"time"
)

var (
	uuidRe   = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	b64UrlRe = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)
	optionRe = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,63}$`)
)

func validateAgenda(a *Agenda) error {
	if !uuidRe.MatchString(a.Id) {
		return fmt.Errorf("agenda id is not a v4 UUID")
	}
	if a.Title == "" {
		return fmt.Errorf("title is required")
	}
	if !isTime(a.OpenAt) || !isTime(a.CloseAt) {
		return fmt.Errorf("openAt/closeAt must be RFC3339")
	}
	if a.OpenAt >= a.CloseAt {
		return fmt.Errorf("openAt must be before closeAt")
	}
	if len(a.Options) < 2 {
		return fmt.Errorf("at least two options required")
	}
	ids := map[string]struct{}{}
	for _, o := range a.Options {
		if !optionRe.MatchString(o.Id) {
			return fmt.Errorf("option id %q invalid", o.Id)
		}
		if _, dup := ids[o.Id]; dup {
			return fmt.Errorf("duplicate option id %q", o.Id)
		}
		ids[o.Id] = struct{}{}
		if o.Label == "" {
			return fmt.Errorf("option label required for %q", o.Id)
		}
	}
	if err := validateAgendaKey(&a.Key); err != nil {
		return err
	}
	if !b64UrlRe.MatchString(a.RegistrarBlindPk) {
		return fmt.Errorf("registrarBlindPk must be base64url")
	}
	return nil
}

func validateAgendaKey(k *AgendaKey) error {
	if !b64UrlRe.MatchString(k.GroupPk) {
		return fmt.Errorf("groupPk must be base64url")
	}
	if k.N < 1 {
		return fmt.Errorf("trustee count n must be >= 1")
	}
	if k.Threshold < 1 || k.Threshold > k.N {
		return fmt.Errorf("threshold must be in [1, n]")
	}
	if len(k.Trustees) != k.N {
		return fmt.Errorf("trustee list length %d != n=%d", len(k.Trustees), k.N)
	}
	seen := map[int]struct{}{}
	for _, t := range k.Trustees {
		if t.Index < 1 {
			return fmt.Errorf("trustee index %d invalid", t.Index)
		}
		if _, dup := seen[t.Index]; dup {
			return fmt.Errorf("duplicate trustee index %d", t.Index)
		}
		seen[t.Index] = struct{}{}
		if !b64UrlRe.MatchString(t.Pk) {
			return fmt.Errorf("trustee %d pk not base64url", t.Index)
		}
	}
	return nil
}

func validateBallot(b *Ballot) error {
	if !uuidRe.MatchString(b.Id) {
		return fmt.Errorf("ballot id must be UUID")
	}
	if !uuidRe.MatchString(b.AgendaId) {
		return fmt.Errorf("agendaId must be UUID")
	}
	// At least two options — matches the schema floor in packages/shared and
	// keeps the disjunctive 0-or-1 proof meaningful.
	if len(b.Options) < 2 {
		return fmt.Errorf("ballot needs at least two encrypted options, got %d", len(b.Options))
	}
	for _, o := range b.Options {
		if !optionRe.MatchString(o.OptionId) {
			return fmt.Errorf("option id %q invalid", o.OptionId)
		}
		if !b64UrlRe.MatchString(o.Ciphertext.C1) || !b64UrlRe.MatchString(o.Ciphertext.C2) {
			return fmt.Errorf("ciphertext for %q not base64url", o.OptionId)
		}
		if len(o.Proof) < 2 {
			return fmt.Errorf("disjunctive proof for %q has <2 parts", o.OptionId)
		}
		for _, p := range o.Proof {
			for _, s := range []string{p.Challenge, p.Response, p.CommitmentA, p.CommitmentB} {
				if !b64UrlRe.MatchString(s) {
					return fmt.Errorf("proof part not base64url")
				}
			}
		}
	}
	if !b64UrlRe.MatchString(b.Credential.Nonce) || !b64UrlRe.MatchString(b.Credential.Signature) {
		return fmt.Errorf("credential fields must be base64url")
	}
	// signature length check: blind signature is the RSA modulus size
	if sigBytes, err := base64.RawURLEncoding.DecodeString(b.Credential.Signature); err != nil || len(sigBytes) < 256 {
		return fmt.Errorf("credential signature invalid or too short")
	}
	if b.SumProof.Commitment == "" || !b64UrlRe.MatchString(b.SumProof.Response) {
		return fmt.Errorf("sum proof missing or malformed")
	}
	return nil
}

func assertBallotMatchesAgenda(b *Ballot, a *Agenda) error {
	expected := map[string]struct{}{}
	for _, o := range a.Options {
		expected[o.Id] = struct{}{}
	}
	seen := map[string]struct{}{}
	for _, bo := range b.Options {
		if _, ok := expected[bo.OptionId]; !ok {
			return fmt.Errorf("ballot has unknown option %q", bo.OptionId)
		}
		if _, dup := seen[bo.OptionId]; dup {
			return fmt.Errorf("ballot repeats option %q", bo.OptionId)
		}
		seen[bo.OptionId] = struct{}{}
	}
	if len(seen) != len(a.Options) {
		return fmt.Errorf("ballot must include all %d options (got %d)", len(a.Options), len(seen))
	}
	return nil
}

func isTime(s string) bool {
	_, err := time.Parse(time.RFC3339, s)
	return err == nil
}
