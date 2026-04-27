# @ovote/crypto

The cryptographic primitives ovote relies on. Pure functions over `@noble/curves` and Web Crypto — no platform-specific code, no I/O, runs in browsers and Node identically.

## Module map

| Module | Primitive | Used by |
|---|---|---|
| `ristretto.ts` | Ristretto255 group + scalar field, base64url codecs | every other module |
| `hash.ts` | Domain-separated `hashToScalar` for Fiat-Shamir | schnorr, disjunctive |
| `elgamal.ts` | Additively-homomorphic ElGamal over Ristretto255 | ballot encryption, aggregate |
| `schnorr.ts` | Schnorr proof-of-knowledge + Chaum-Pedersen equality-of-DLogs | ballot sum proof, trustee shares |
| `disjunctive.ts` | OR-proof: "this ciphertext is in {0·G, 1·G}" | ballot per-option proofs |
| `threshold.ts` | Trusted-dealer Shamir keygen, partial decryption, Lagrange recombination | trustees, tally |
| `blind-signature.ts` | RSA-BSSA blind signatures (RFC 9474) | voter credential issuance |

`scripts/dump-vectors.ts` is a deterministic golden-vector dumper that emits fixtures for the Go chaincode's parity tests. See [docs/ARCHITECTURE.md § Cross-language parity](../../docs/ARCHITECTURE.md#cross-language-parity-ts--go).

## What this package guarantees

- **Constant-ish-time scalar arithmetic** via `@noble/curves` — good enough for verification on a server but never used for signing where timing matters (`OVOTE_SECRET_KEY` does not get used for signing).
- **Domain separation** on every Fiat-Shamir hash. Every challenge is `H("ovote/v1/<domain>" || transcript)`. Adding a new proof requires a new domain string; reusing an existing one across protocols is a bug.
- **Byte-level reproducibility.** Every encoding (point, scalar, proof) round-trips through base64url and yields the same bytes the Go port produces.

## What it does NOT guarantee

- Constant-time on platforms where `@noble/curves` is not constant-time (mostly fine on V8; check the upstream notes).
- Side-channel resistance against a co-located attacker. Ballots run on user devices; coercion-resistance is out of scope.
- Forward secrecy of trustee secret shares — they live in the trustee's browser storage during the election. Operators should follow the trustee handout procedure in [docs/OPERATIONS.md](../../docs/OPERATIONS.md).

## Reading order

If you want to understand the protocol from this package:

1. `ristretto.ts` — group element interface
2. `hash.ts` — Fiat-Shamir transcript construction
3. `elgamal.ts` — homomorphic encryption
4. `schnorr.ts` — non-interactive ZK building blocks
5. `disjunctive.ts` — per-option ballot proofs
6. `threshold.ts` — trustee math
7. `blind-signature.ts` — voter credentials

[ADR 0003](../../docs/adr/0003-cryptographic-scheme.md) explains the choice of each scheme.

## Tests

```bash
pnpm --filter @ovote/crypto test
```

Crypto modules ship with end-to-end round-trip tests: prove → verify, encrypt → decrypt, threshold split → recombine. New primitives MUST have a positive *and* a negative test (a tampered proof must fail verification).
