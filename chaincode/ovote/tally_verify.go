package main

import (
	"fmt"

	"github.com/gtank/ristretto255"
	"github.com/ovote/chaincode/crypto"
)

// verifyPublishedTally re-runs the full tally crypto on-chain. It mirrors
// what an off-chain auditor would do with @ovote/crypto:
//
//  1. Aggregate each option's ciphertext over every cast ballot.
//  2. For each option, verify each submitted trustee share's
//     equality-of-DLogs proof (using the agenda-registered trustee pubkey).
//  3. Pick the first `threshold` valid shares, Lagrange-combine to recover
//     m*G, and brute-force the small discrete log up to ballotCount.
//  4. Confirm the recovered m matches the published count.
//
// Anything that doesn't add up here is fatal — the chaincode refuses to
// persist the tally. The byte-level parity of every crypto primitive used
// here is asserted in chaincode/ovote/crypto/crypto_test.go.
func verifyPublishedTally(
	agenda *Agenda,
	results []OptionResult,
	ballots []*Ballot,
	sharesByOption map[string][]*TrusteeDecryptionShare,
) error {
	trusteePk, err := decodeTrusteePks(agenda)
	if err != nil {
		return err
	}

	// 1) Aggregate per option once. ballots is small enough (consortium scale)
	// that a single pass is fine.
	aggC1, aggC2, err := aggregateCiphertexts(agenda, ballots)
	if err != nil {
		return err
	}

	// Quick map of declared count by option.
	declared := map[string]int{}
	for _, r := range results {
		declared[r.OptionId] = r.Count
	}

	for _, opt := range agenda.Options {
		c1, ok1 := aggC1[opt.Id]
		c2, ok2 := aggC2[opt.Id]
		if !ok1 || !ok2 {
			// No ballots → aggregate is the identity. m must be 0.
			if declared[opt.Id] != 0 {
				return fmt.Errorf("option %q has 0 ballots but declared count %d", opt.Id, declared[opt.Id])
			}
			continue
		}

		validShares, validIdx, err := verifyAndCollectShares(opt.Id, c1, sharesByOption[opt.Id], trusteePk)
		if err != nil {
			return err
		}
		if len(validShares) < agenda.Key.Threshold {
			return fmt.Errorf("option %q only has %d valid shares (need %d)",
				opt.Id, len(validShares), agenda.Key.Threshold)
		}

		// Use exactly threshold shares so Lagrange picks a deterministic basis.
		picked := validShares[:agenda.Key.Threshold]
		pickedIdx := validIdx[:agenda.Key.Threshold]
		mPoint := crypto.CombineShares(pickedIdx, picked, c2)

		m, err := crypto.SolveSmallDiscreteLog(mPoint, uint64(len(ballots)))
		if err != nil {
			return fmt.Errorf("option %q: %w", opt.Id, err)
		}
		if int(m) != declared[opt.Id] {
			return fmt.Errorf("option %q: recovered count %d does not match declared %d",
				opt.Id, m, declared[opt.Id])
		}
	}
	return nil
}

func decodeTrusteePks(agenda *Agenda) (map[int]*ristretto255.Element, error) {
	out := make(map[int]*ristretto255.Element, len(agenda.Key.Trustees))
	for _, t := range agenda.Key.Trustees {
		pk, err := crypto.DecodePoint(t.Pk)
		if err != nil {
			return nil, fmt.Errorf("trustee %d pubkey decode: %w", t.Index, err)
		}
		out[t.Index] = pk
	}
	return out, nil
}

func aggregateCiphertexts(
	agenda *Agenda,
	ballots []*Ballot,
) (map[string]*ristretto255.Element, map[string]*ristretto255.Element, error) {
	c1Sum := map[string]*ristretto255.Element{}
	c2Sum := map[string]*ristretto255.Element{}
	for _, b := range ballots {
		for _, opt := range b.Options {
			if !optionExists(agenda, opt.OptionId) {
				return nil, nil, fmt.Errorf("ballot %s references unknown option %q", b.Id, opt.OptionId)
			}
			c1, err := crypto.DecodePoint(opt.Ciphertext.C1)
			if err != nil {
				return nil, nil, fmt.Errorf("ballot %s option %s c1: %w", b.Id, opt.OptionId, err)
			}
			c2, err := crypto.DecodePoint(opt.Ciphertext.C2)
			if err != nil {
				return nil, nil, fmt.Errorf("ballot %s option %s c2: %w", b.Id, opt.OptionId, err)
			}
			if existing, ok := c1Sum[opt.OptionId]; ok {
				existing.Add(existing, c1)
				c2Sum[opt.OptionId].Add(c2Sum[opt.OptionId], c2)
			} else {
				c1Sum[opt.OptionId] = c1
				c2Sum[opt.OptionId] = c2
			}
		}
	}
	return c1Sum, c2Sum, nil
}

// verifyAndCollectShares walks the submitted shares for one option, drops
// invalid ones, and returns the points + indices in a deterministic order
// (sorted by trusteeIndex so Lagrange basis is reproducible across peers).
func verifyAndCollectShares(
	optionId string,
	aggC1 *ristretto255.Element,
	shares []*TrusteeDecryptionShare,
	trusteePk map[int]*ristretto255.Element,
) ([]*ristretto255.Element, []int, error) {
	// Sort by trusteeIndex for deterministic Lagrange selection across peers.
	ordered := append([]*TrusteeDecryptionShare(nil), shares...)
	sortByIndex(ordered)

	base := ristretto255.NewElement().Base()
	var points []*ristretto255.Element
	var idx []int
	for _, s := range ordered {
		pk, ok := trusteePk[s.TrusteeIndex]
		if !ok {
			return nil, nil, fmt.Errorf("option %q: trustee %d not registered", optionId, s.TrusteeIndex)
		}
		share, err := crypto.DecodePoint(s.Share)
		if err != nil {
			return nil, nil, fmt.Errorf("option %q: trustee %d share decode: %w", optionId, s.TrusteeIndex, err)
		}
		ok2, err := crypto.VerifyEqualityOfDiscreteLogs(
			"trustee-decrypt",
			base, pk, aggC1, share,
			crypto.SchnorrProof{Commitment: s.Proof.Commitment, Response: s.Proof.Response},
		)
		if err != nil {
			return nil, nil, fmt.Errorf("option %q: trustee %d proof decode: %w", optionId, s.TrusteeIndex, err)
		}
		if !ok2 {
			// Skip invalid share rather than abort — caller still needs ≥threshold valid.
			continue
		}
		points = append(points, share)
		idx = append(idx, s.TrusteeIndex)
	}
	return points, idx, nil
}

// sortByIndex puts shares in ascending trusteeIndex order. Insertion sort —
// trustee count is small (typically 3-7).
func sortByIndex(s []*TrusteeDecryptionShare) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j-1].TrusteeIndex > s[j].TrusteeIndex; j-- {
			s[j-1], s[j] = s[j], s[j-1]
		}
	}
}
