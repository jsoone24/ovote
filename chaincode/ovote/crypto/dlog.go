package crypto

import (
	"fmt"

	"github.com/gtank/ristretto255"
)

// SolveSmallDiscreteLog returns m such that m*G == target, searching the
// closed range [0, max]. Returns an error if no match is found within the
// range — the caller (PublishResult on chaincode) calls this with max =
// ballotCount, so anything outside [0..ballotCount] is provably wrong.
//
// Linear search is fine because consortium-scale max is in the thousands at
// worst; baby-step giant-step would optimise this if we ever cared.
func SolveSmallDiscreteLog(target *ristretto255.Element, max uint64) (uint64, error) {
	zero := ristretto255.NewElement().Zero()
	if target.Equal(zero) == 1 {
		return 0, nil
	}
	base := ristretto255.NewElement().Base()
	current := ristretto255.NewElement().Base() // 1*G
	for k := uint64(1); k <= max; k++ {
		if current.Equal(target) == 1 {
			return k, nil
		}
		current.Add(current, base)
	}
	return 0, fmt.Errorf("discrete log not found in [0, %d]", max)
}
