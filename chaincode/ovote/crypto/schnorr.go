package crypto

import (
	"strings"

	"github.com/gtank/ristretto255"
)

// SchnorrProof matches the TS SchnorrProof shape on the wire: commitment is
// "<A>.<B>" where A and B are base64url-encoded ristretto points; response is
// the base64url-encoded scalar.
type SchnorrProof struct {
	Commitment string
	Response   string
}

// VerifyEqualityOfDiscreteLogs is the Go port of
// packages/crypto/src/schnorr.ts verifyEqualityOfDiscreteLogs.
//
// Verifies that the prover knew x such that h1 = x*g1 AND h2 = x*g2, given a
// non-interactive Schnorr-style proof. The Fiat-Shamir challenge is computed
// over (g1, h1, g2, h2, A, B) using HashToScalar(domain, ...) — this MUST
// match the TS verifier byte-for-byte.
func VerifyEqualityOfDiscreteLogs(
	domain string,
	g1, h1, g2, h2 *ristretto255.Element,
	proof SchnorrProof,
) (bool, error) {
	parts := strings.Split(proof.Commitment, ".")
	if len(parts) != 2 {
		return false, nil
	}
	A, err := DecodePoint(parts[0])
	if err != nil {
		return false, err
	}
	B, err := DecodePoint(parts[1])
	if err != nil {
		return false, err
	}
	s, err := DecodeScalar(proof.Response)
	if err != nil {
		return false, err
	}

	c := HashToScalar(domain, [][]byte{
		g1.Encode(nil),
		h1.Encode(nil),
		g2.Encode(nil),
		h2.Encode(nil),
		A.Encode(nil),
		B.Encode(nil),
	})

	// lhsA = s*g1, rhsA = A + c*h1
	lhsA := ristretto255.NewElement().ScalarMult(s, g1)
	chl1 := ristretto255.NewElement().ScalarMult(c, h1)
	rhsA := ristretto255.NewElement().Add(A, chl1)

	// lhsB = s*g2, rhsB = B + c*h2
	lhsB := ristretto255.NewElement().ScalarMult(s, g2)
	chl2 := ristretto255.NewElement().ScalarMult(c, h2)
	rhsB := ristretto255.NewElement().Add(B, chl2)

	return lhsA.Equal(rhsA) == 1 && lhsB.Equal(rhsB) == 1, nil
}
