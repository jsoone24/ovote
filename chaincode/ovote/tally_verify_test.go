package main

import (
	"encoding/json"
	"os"
	"testing"
)

// fixtureVectors is the relevant slice of the JSON shape emitted by
// packages/crypto/scripts/dump-vectors.ts. We re-decode here (rather than
// reach into the crypto subpackage's private types) to keep main isolated.
type fixtureVectors struct {
	ThresholdDecryption struct {
		Threshold int `json:"threshold"`
		Trustees  []struct {
			Index int    `json:"index"`
			Pk    string `json:"pk"`
		} `json:"trustees"`
		Aggregate struct {
			C1 string `json:"c1"`
			C2 string `json:"c2"`
		} `json:"aggregate"`
		Shares []struct {
			Index int    `json:"index"`
			Share string `json:"share"`
			Proof struct {
				Commitment string `json:"commitment"`
				Response   string `json:"response"`
			} `json:"proof"`
		} `json:"shares"`
		ExpectedM int `json:"expectedM"`
	} `json:"thresholdDecryption"`
}

func loadFixture(t *testing.T) *fixtureVectors {
	t.Helper()
	data, err := os.ReadFile("crypto/testdata/vectors.json")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var v fixtureVectors
	if err := json.Unmarshal(data, &v); err != nil {
		t.Fatalf("parse fixture: %v", err)
	}
	return &v
}

// TestVerifyPublishedTally_HappyPath wires the parity fixture through the
// full chaincode-side verifier. The fixture's aggregate represents what the
// trustees decrypted; we synthesize `ExpectedM` identical ballots so the
// "counts sum to ballot count" sanity passes and the dlog solver can recover
// the true count.
func TestVerifyPublishedTally_HappyPath(t *testing.T) {
	v := loadFixture(t)
	td := v.ThresholdDecryption

	agenda := &Agenda{
		Id:      "test-agenda",
		Options: []AgendaOption{{Id: "yes", Label: "Yes"}},
		Key: AgendaKey{
			Threshold: td.Threshold,
			N:         len(td.Trustees),
			Trustees:  make([]TrusteePublicShare, len(td.Trustees)),
		},
	}
	for i, t2 := range td.Trustees {
		agenda.Key.Trustees[i] = TrusteePublicShare{Index: t2.Index, Pk: t2.Pk}
	}

	// Synthesize ExpectedM ballots that all encode the fixture's aggregate
	// ciphertext exactly once. The verifier sums each ballot's individual
	// ciphertext for option "yes" — so we put the *aggregate* on a single
	// ballot and pad the rest with the additive identity (we can't easily
	// produce per-ballot ciphertexts without re-running ElGamal). The
	// "ballot count" sanity check still requires `ExpectedM` ballots total.
	//
	// Identity encoding: c1 = c2 = ristretto255 zero. Encoded as
	// AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA (32 zero bytes b64url).
	zeroB64 := "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
	ballots := make([]*Ballot, td.ExpectedM)
	for i := range ballots {
		c1, c2 := zeroB64, zeroB64
		if i == 0 {
			c1, c2 = td.Aggregate.C1, td.Aggregate.C2
		}
		ballots[i] = &Ballot{
			Id:       "b-" + string(rune('a'+i)),
			AgendaId: agenda.Id,
			Options: []BallotOptionCiphertext{
				{OptionId: "yes", Ciphertext: Ciphertext{C1: c1, C2: c2}},
			},
		}
	}

	// Wrap the fixture's shares as the chaincode's TrusteeDecryptionShare type.
	sharesByOption := map[string][]*TrusteeDecryptionShare{
		"yes": make([]*TrusteeDecryptionShare, 0, len(td.Shares)),
	}
	for _, s := range td.Shares {
		sharesByOption["yes"] = append(sharesByOption["yes"], &TrusteeDecryptionShare{
			AgendaId:     agenda.Id,
			OptionId:     "yes",
			TrusteeIndex: s.Index,
			Share:        s.Share,
			Proof:        SchnorrProof{Commitment: s.Proof.Commitment, Response: s.Proof.Response},
		})
	}

	results := []OptionResult{{OptionId: "yes", Count: td.ExpectedM}}

	if err := verifyPublishedTally(agenda, results, ballots, sharesByOption); err != nil {
		t.Fatalf("verifyPublishedTally returned error on valid fixture: %v", err)
	}
}

// TestVerifyPublishedTally_RejectsInflatedCount asserts that flipping the
// declared count (with everything else valid) fails verification — i.e. a
// compromised admin really can't lie about the totals.
func TestVerifyPublishedTally_RejectsInflatedCount(t *testing.T) {
	v := loadFixture(t)
	td := v.ThresholdDecryption

	agenda := &Agenda{
		Id:      "test-agenda",
		Options: []AgendaOption{{Id: "yes", Label: "Yes"}},
		Key: AgendaKey{
			Threshold: td.Threshold,
			N:         len(td.Trustees),
			Trustees:  make([]TrusteePublicShare, len(td.Trustees)),
		},
	}
	for i, t2 := range td.Trustees {
		agenda.Key.Trustees[i] = TrusteePublicShare{Index: t2.Index, Pk: t2.Pk}
	}

	zeroB64 := "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
	ballots := make([]*Ballot, td.ExpectedM)
	for i := range ballots {
		c1, c2 := zeroB64, zeroB64
		if i == 0 {
			c1, c2 = td.Aggregate.C1, td.Aggregate.C2
		}
		ballots[i] = &Ballot{
			Id:       "b-" + string(rune('a'+i)),
			AgendaId: agenda.Id,
			Options:  []BallotOptionCiphertext{{OptionId: "yes", Ciphertext: Ciphertext{C1: c1, C2: c2}}},
		}
	}
	sharesByOption := map[string][]*TrusteeDecryptionShare{
		"yes": make([]*TrusteeDecryptionShare, 0, len(td.Shares)),
	}
	for _, s := range td.Shares {
		sharesByOption["yes"] = append(sharesByOption["yes"], &TrusteeDecryptionShare{
			AgendaId:     agenda.Id,
			OptionId:     "yes",
			TrusteeIndex: s.Index,
			Share:        s.Share,
			Proof:        SchnorrProof{Commitment: s.Proof.Commitment, Response: s.Proof.Response},
		})
	}

	// Inflate the declared count by 1 — crypto recovers ExpectedM, mismatch
	// must fail.
	results := []OptionResult{{OptionId: "yes", Count: td.ExpectedM + 1}}
	err := verifyPublishedTally(agenda, results, ballots, sharesByOption)
	if err == nil {
		t.Fatal("expected verifyPublishedTally to reject inflated count, got nil")
	}
}
