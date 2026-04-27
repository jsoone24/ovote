package crypto

import (
	"encoding/binary"

	"github.com/gtank/ristretto255"
)

// scalarFromUint mirrors TS scalarFromUint: scalar = n mod L. Trustee indices
// are positive integers (1..n), so we encode them as little-endian 32 bytes
// with the top bytes zero — well within L.
func scalarFromUint(n uint64) *ristretto255.Scalar {
	var buf [32]byte
	binary.LittleEndian.PutUint64(buf[:8], n)
	s := ristretto255.NewScalar()
	if err := s.Decode(buf[:]); err != nil {
		panic("ristretto255.Scalar.Decode failed for tiny scalar: " + err.Error())
	}
	return s
}

// LagrangeCoefficient is the Go port of Threshold.lagrangeCoefficient — the
// Lagrange basis polynomial L_i(0) over the scalar field, used to recombine
// trustee shares at x=0 (the master secret position).
func LagrangeCoefficient(indexI int, allIndices []int) *ristretto255.Scalar {
	num := scalarFromUint(1)
	den := scalarFromUint(1)
	xi := scalarFromUint(uint64(indexI))

	for _, j := range allIndices {
		if j == indexI {
			continue
		}
		xj := scalarFromUint(uint64(j))
		negXj := ristretto255.NewScalar().Negate(xj)

		num = ristretto255.NewScalar().Multiply(num, negXj)

		// den *= (xi + (-xj)) = (xi - xj)
		diff := ristretto255.NewScalar().Add(xi, negXj)
		den = ristretto255.NewScalar().Multiply(den, diff)
	}
	invDen := ristretto255.NewScalar().Invert(den)
	return ristretto255.NewScalar().Multiply(num, invDen)
}

// CombineShares is the Go port of Threshold.combineShares.
//
// Given t valid trustee decryption shares for an aggregate ciphertext (c1, c2)
// — each share s_i = sk_i * c1 — recover m*G = c2 - Σ λ_i * s_i.
//
// Caller is responsible for having already verified each share's
// VerifyEqualityOfDiscreteLogs proof.
func CombineShares(
	indices []int,
	shares []*ristretto255.Element, // same order as indices
	c2 *ristretto255.Element,
) *ristretto255.Element {
	combined := ristretto255.NewElement().Zero()
	for k, idx := range indices {
		lambda := LagrangeCoefficient(idx, indices)
		term := ristretto255.NewElement().ScalarMult(lambda, shares[k])
		combined.Add(combined, term)
	}
	return ristretto255.NewElement().Subtract(c2, combined)
}
