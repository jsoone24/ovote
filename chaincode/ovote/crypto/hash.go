package crypto

import (
	"crypto/sha256"

	"github.com/gtank/ristretto255"
)

// HashToScalar mirrors packages/crypto/src/hash.ts hashToScalar.
//
// The TS implementation does:
//
//	domainBytes = utf8("ovote/v1/" + domain)
//	first  = sha256(domainBytes || parts[0] || parts[1] || ...)
//	second = sha256(first)
//	wide   = first || second                       // 64 bytes
//	acc    = bigint(wide, "big-endian")
//	result = acc mod L                              // L = ristretto255 order
//
// gtank's Scalar.FromUniformBytes reduces 64 little-endian bytes mod L.
// So we reverse the BE wide buffer to LE before passing it in. Result is
// byte-identical to the TS scalar (verified by crypto_test.go fixtures).
func HashToScalar(domain string, parts [][]byte) *ristretto255.Scalar {
	first := sha256.New()
	first.Write([]byte("ovote/v1/" + domain))
	for _, p := range parts {
		first.Write(p)
	}
	digest1 := first.Sum(nil)
	digest2 := sha256.Sum256(digest1)

	wideBE := make([]byte, 64)
	copy(wideBE[0:32], digest1)
	copy(wideBE[32:64], digest2[:])

	wideLE := make([]byte, 64)
	for i := 0; i < 64; i++ {
		wideLE[63-i] = wideBE[i]
	}

	s := ristretto255.NewScalar()
	if _, err := s.SetUniformBytes(wideLE); err != nil {
		// SetUniformBytes only fails on length mismatch and we always pass 64.
		panic("ristretto255.SetUniformBytes failed on 64 bytes: " + err.Error())
	}
	return s
}
