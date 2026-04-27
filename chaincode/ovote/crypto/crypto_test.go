package crypto

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/gtank/ristretto255"
)

// vectors mirrors the JSON shape emitted by
// packages/crypto/scripts/dump-vectors.ts. The whole point of these tests is
// that any byte-level drift between TS @ovote/crypto and this Go package will
// fail the chaincode build, so an admin can never publish a tally that the
// chain blesses but the auditor's TS-side recomputation rejects.
type vectors struct {
	Version       int `json:"version"`
	HashToScalar  []struct {
		Domain string   `json:"domain"`
		Parts  []string `json:"parts"`
		Scalar string   `json:"scalar"`
	} `json:"hashToScalar"`
	SchnorrEqualityOfDLogs []struct {
		Domain string `json:"domain"`
		G1     string `json:"g1"`
		H1     string `json:"h1"`
		G2     string `json:"g2"`
		H2     string `json:"h2"`
		Proof  struct {
			Commitment string `json:"commitment"`
			Response   string `json:"response"`
		} `json:"proof"`
		ExpectedValid bool `json:"expectedValid"`
	} `json:"schnorrEqualityOfDLogs"`
	LagrangeCoefficient []struct {
		Index       int    `json:"index"`
		AllIndices  []int  `json:"allIndices"`
		Coefficient string `json:"coefficient"`
	} `json:"lagrangeCoefficient"`
	ThresholdDecryption struct {
		Threshold int `json:"threshold"`
		Trustees  []struct {
			Index int    `json:"index"`
			Pk    string `json:"pk"`
		} `json:"trustees"`
		GroupPk   string `json:"groupPk"`
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

func loadVectors(t *testing.T) *vectors {
	t.Helper()
	data, err := os.ReadFile("testdata/vectors.json")
	if err != nil {
		t.Fatalf("read fixtures: %v", err)
	}
	var v vectors
	if err := json.Unmarshal(data, &v); err != nil {
		t.Fatalf("parse fixtures: %v", err)
	}
	if v.Version != 1 {
		t.Fatalf("fixture schema version mismatch: got %d, want 1 (regenerate with packages/crypto/scripts/dump-vectors.ts)", v.Version)
	}
	return &v
}

func TestHashToScalarParity(t *testing.T) {
	v := loadVectors(t)
	for _, tc := range v.HashToScalar {
		parts := make([][]byte, len(tc.Parts))
		for i, p := range tc.Parts {
			b, err := DecodeBytes(p)
			if err != nil {
				t.Fatalf("decode part: %v", err)
			}
			parts[i] = b
		}
		got := HashToScalar(tc.Domain, parts)
		expected, err := DecodeScalar(tc.Scalar)
		if err != nil {
			t.Fatalf("decode expected scalar: %v", err)
		}
		if got.Equal(expected) != 1 {
			t.Errorf("HashToScalar(%q, %d parts) drift: got %x, want %x",
				tc.Domain, len(parts), got.Encode(nil), expected.Encode(nil))
		}
	}
}

func TestSchnorrEqualityOfDLogsParity(t *testing.T) {
	v := loadVectors(t)
	for i, tc := range v.SchnorrEqualityOfDLogs {
		g1, err := DecodePoint(tc.G1)
		if err != nil {
			t.Fatalf("case %d g1: %v", i, err)
		}
		h1, err := DecodePoint(tc.H1)
		if err != nil {
			t.Fatalf("case %d h1: %v", i, err)
		}
		g2, err := DecodePoint(tc.G2)
		if err != nil {
			t.Fatalf("case %d g2: %v", i, err)
		}
		h2, err := DecodePoint(tc.H2)
		if err != nil {
			t.Fatalf("case %d h2: %v", i, err)
		}
		ok, err := VerifyEqualityOfDiscreteLogs(tc.Domain, g1, h1, g2, h2, SchnorrProof{
			Commitment: tc.Proof.Commitment,
			Response:   tc.Proof.Response,
		})
		if err != nil {
			t.Fatalf("case %d verify: %v", i, err)
		}
		if ok != tc.ExpectedValid {
			t.Errorf("case %d: got valid=%v, want %v", i, ok, tc.ExpectedValid)
		}
	}
}

func TestLagrangeCoefficientParity(t *testing.T) {
	v := loadVectors(t)
	for i, tc := range v.LagrangeCoefficient {
		got := LagrangeCoefficient(tc.Index, tc.AllIndices)
		expected, err := DecodeScalar(tc.Coefficient)
		if err != nil {
			t.Fatalf("case %d decode: %v", i, err)
		}
		if got.Equal(expected) != 1 {
			t.Errorf("case %d: LagrangeCoefficient(%d, %v) drift", i, tc.Index, tc.AllIndices)
		}
	}
}

func TestThresholdDecryptionEndToEnd(t *testing.T) {
	v := loadVectors(t)
	td := v.ThresholdDecryption

	// 1) Verify each share's Schnorr proof. The check requires:
	//    g1 = BASE, h1 = trustee.pk, g2 = aggregate.c1, h2 = share
	c1, err := DecodePoint(td.Aggregate.C1)
	if err != nil {
		t.Fatalf("decode aggregate.c1: %v", err)
	}
	c2, err := DecodePoint(td.Aggregate.C2)
	if err != nil {
		t.Fatalf("decode aggregate.c2: %v", err)
	}
	base := ristretto255.NewElement().Base()

	trusteePk := map[int]*ristretto255.Element{}
	for _, t2 := range td.Trustees {
		pk, err := DecodePoint(t2.Pk)
		if err != nil {
			t.Fatalf("decode trustee pk %d: %v", t2.Index, err)
		}
		trusteePk[t2.Index] = pk
	}

	type validShare struct {
		index int
		share *ristretto255.Element
	}
	var valid []validShare
	for _, s := range td.Shares {
		share, err := DecodePoint(s.Share)
		if err != nil {
			t.Fatalf("decode share %d: %v", s.Index, err)
		}
		ok, err := VerifyEqualityOfDiscreteLogs("trustee-decrypt",
			base, trusteePk[s.Index], c1, share,
			SchnorrProof{Commitment: s.Proof.Commitment, Response: s.Proof.Response})
		if err != nil || !ok {
			t.Fatalf("share %d failed verification (err=%v ok=%v)", s.Index, err, ok)
		}
		valid = append(valid, validShare{s.Index, share})
	}

	// 2) Pick the first `threshold` shares and combine.
	if len(valid) < td.Threshold {
		t.Fatalf("not enough valid shares: %d < %d", len(valid), td.Threshold)
	}
	picked := valid[:td.Threshold]
	indices := make([]int, len(picked))
	shares := make([]*ristretto255.Element, len(picked))
	for i, p := range picked {
		indices[i] = p.index
		shares[i] = p.share
	}
	mPoint := CombineShares(indices, shares, c2)

	// 3) Solve dlog. Bound = expected + a few extra so off-by-one is caught.
	m, err := SolveSmallDiscreteLog(mPoint, uint64(td.ExpectedM)+5)
	if err != nil {
		t.Fatalf("solve dlog: %v", err)
	}
	if int(m) != td.ExpectedM {
		t.Errorf("dlog: got m=%d, want %d", m, td.ExpectedM)
	}
}
