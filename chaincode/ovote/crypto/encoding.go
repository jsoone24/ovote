// Package crypto is the Go port of the subset of @ovote/crypto that the
// chaincode needs to fully verify a published tally on-chain. It must be
// byte-for-byte identical to the TypeScript implementation; cross-language
// parity is asserted in crypto_test.go using fixtures emitted by
// packages/crypto/scripts/dump-vectors.ts.
package crypto

import (
	"encoding/base64"
	"fmt"

	"github.com/gtank/ristretto255"
)

// b64UrlNoPad mirrors @ovote/shared's base64url encoding: URL-safe alphabet,
// no padding. Matches Node Buffer.from(s, 'base64url') / s.toString('base64url').
var b64UrlNoPad = base64.RawURLEncoding

// DecodeBytes decodes a base64url string to raw bytes. Empty string OK.
func DecodeBytes(s string) ([]byte, error) {
	return b64UrlNoPad.DecodeString(s)
}

// DecodePoint decodes a base64url-encoded ristretto255 element.
func DecodePoint(s string) (*ristretto255.Element, error) {
	raw, err := DecodeBytes(s)
	if err != nil {
		return nil, fmt.Errorf("decode point base64url: %w", err)
	}
	if len(raw) != 32 {
		return nil, fmt.Errorf("point must be 32 bytes, got %d", len(raw))
	}
	p := ristretto255.NewElement()
	if err := p.Decode(raw); err != nil {
		return nil, fmt.Errorf("decode ristretto point: %w", err)
	}
	return p, nil
}

// DecodeScalar decodes a base64url-encoded ristretto255 scalar (32 bytes
// little-endian, canonical i.e. < L).
func DecodeScalar(s string) (*ristretto255.Scalar, error) {
	raw, err := DecodeBytes(s)
	if err != nil {
		return nil, fmt.Errorf("decode scalar base64url: %w", err)
	}
	if len(raw) != 32 {
		return nil, fmt.Errorf("scalar must be 32 bytes, got %d", len(raw))
	}
	sc := ristretto255.NewScalar()
	if err := sc.Decode(raw); err != nil {
		return nil, fmt.Errorf("decode ristretto scalar: %w", err)
	}
	return sc, nil
}
