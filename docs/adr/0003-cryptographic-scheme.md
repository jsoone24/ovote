# ADR 0003 — Cryptographic Scheme (DRAFT — pending open decisions)

- Status: **Accepted**
- Date: 2026-04-23
- Related: ADR 0001 (scope), ADR 0002 (properties), ADR 0004 (voter authentication)

## Context

ADR 0002 commits us to a Helios/ElectionGuard/Belenios-family scheme: threshold ElGamal + disjunctive Chaum-Pedersen zero-knowledge proofs + homomorphic tally on a Fabric bulletin board, with re-voting for partial coercion mitigation and Benaloh cast-or-challenge for end-to-end verifiability.

This ADR fixes the concrete primitive choices. Several of those choices depend on operational decisions that require the user's input.

## Decision — fixed parts

### Ballot lifecycle

```
Voter client:
  1. Fetch agenda metadata and trustee public key PK from bulletin board.
  2. Voter chooses option v ∈ {0, 1}^k (k = number of options, one-hot).
  3. Client samples randomness r, computes ciphertext C = ElGamal_Enc(PK, v; r).
  4. Client produces disjunctive Chaum-Pedersen proof π that C encrypts a
     well-formed one-hot vector (exactly one 1, rest 0s), without revealing
     which position.
  5. Client attaches one-time ballot credential σ issued by registrar.
  6. Ballot (C, π, σ, agenda_id, bucketed_timestamp) signed and submitted.

Chaincode (on ballot submission):
  7. Verify σ (unspent, valid registrar signature, matches agenda).
  8. Verify π (ballot well-formedness).
  9. Reject if either fails. Otherwise append to ledger.
 10. Mark σ as spent. Any subsequent submission with the same σ is rejected.

At close:
 11. Trustees jointly compute homomorphic aggregate A = Σ C_i over all valid ballots
     (one per credential by construction).
 12. Trustees run threshold-decrypt protocol, producing plaintext tally T and
     a proof π_tally that T is the correct decryption of A.
 13. (T, π_tally) published to the ledger. Any verifier can check π_tally using
     the public tally transcript.

Auditor / observer:
 14. Download full ledger, re-verify every π, verify π_tally, recompute result.
```

### Fixed primitive choices

- **Group:** prime-order group, 128-bit security. **Proposed default: Ristretto255** (`github.com/gtank/ristretto255` on the Go side; `@noble/curves/ed25519` Ristretto variant on the JS side). Rationale: no cofactor footgun, constant-time implementations, excellent library support both sides.
- **ElGamal variant:** exponential ElGamal (encrypts `g^v`, not `v`) to support homomorphic aggregation. Final tally recovered by discrete-log lookup over the bounded result space (small, feasible for `≤ total_voters`).
- **ZK proof:** disjunctive (OR-composition) Chaum-Pedersen, Fiat-Shamir transformed with SHA-256. Transcript includes agenda ID, trustee PK, and ciphertext — domain separation per election.
- **Threshold scheme:** Pedersen's distributed key generation (DKG), `t`-of-`n`. DKG transcripts published to the ledger before voting opens so the public key is verifiably generated.
- **Cast-or-challenge (Benaloh):** client UI offers "cast" or "challenge" after encryption. Challenge reveals randomness, proving cast-as-intended; ballot is then discarded and re-encrypted. Voters are not required to challenge; a statistical sample is enough for assurance.
- **Re-voting:** **not supported.** Each ballot credential `σ` is strictly single-use. The chaincode rejects any second submission using an already-spent credential. See D4 below.
- **Timestamp granularity on ledger:** bucketed to nearest 60 seconds. Exact submission time is not stored.

### Off-chain / on-chain split

| Artifact | Lives on | Rationale |
|---|---|---|
| Voter identity, email, eligibility | Off-chain registrar DB | PII; subject to erasure |
| Anonymous ballot credential `σ` | Issued off-chain, presented on-chain, spent state on-chain | `σ` is unlinkable to voter |
| Ballot ciphertext `C`, proof `π` | On-chain | Immutable bulletin board |
| Trustee public-key shares, DKG transcript | On-chain | Publicly verifiable |
| Trustee private-key shares | In trustee-controlled hardware (YubiKey / HSM / OS secure enclave) | Never written to disk unencrypted |
| Final tally `T` and proof `π_tally` | On-chain | Publicly verifiable |

## Decisions — D1–D5 (all resolved)

### D1 — Trustee threshold — **DECIDED: configurable, default 3-of-5**

Higher `n` = better decentralization; higher `t` = stronger secrecy but worse availability. 3-of-5 tolerates 2 offline trustees and requires 3-party collusion to break secrecy. Operators may override in deployment config (e.g., 2-of-3 for small deployments).

### D2 — Voter authentication — **DECIDED: passkey primary + email-OTP fallback (v1 ships email-OTP only)**

Target architecture: passkey (WebAuthn) primary, email-OTP fallback. **v1 ships email-OTP only** for implementation simplicity; passkey support is a v2 addition without architectural rework. SSO (OIDC/SAML) is considered a v3+ integration for institutional deployments. Details in ADR 0004.

### D3 — Credential issuance — **DECIDED: Chaum blind signatures**

Voter blinds a random token, registrar signs the blinded token, voter unblinds to get a signed token. Registrar cannot link the signed token back to any voter. Strong unlinkability; moderate implementation complexity. Deterministic per-voter tokens were rejected because the registrar would be able to re-link, violating ADR 0002.

### D4 — Voting window / re-voting policy — **DECIDED: no re-voting**

Each ballot credential is strictly single-use. Any second submission with the same credential is rejected by the chaincode.

**Trade-offs accepted:**
- Gain: simpler chaincode (no latest-ballot-per-credential tracking), simpler UX, traditional one-shot mental model.
- Loss: coercion resistance is downgraded to **not claimed** in ADR 0002. No online mechanism protects a voter who casts while observed.
- UX risk: lost voter device before cast = disenfranchisement for that agenda. Out-of-band credential reissuance would touch voter identity and weaken the non-linkability claim, so it is intentionally not offered. Operators must communicate this to voters before the voting window opens.

### D5 — Bulletin board readability — **DECIDED: publicly readable**

The bulletin board contains only anonymous ballot credentials, ciphertexts, ZK proofs, trustee key material, and tally proofs — no PII (ADR 0002). Public readability is a precondition for real end-to-end verifiability: any auditor can download the full ledger and independently verify every proof and the final tally.

## Dependencies, libraries

- **Go chaincode:** `github.com/gtank/ristretto255`, standard-library `crypto/sha256`, `crypto/ed25519` (for blind-signature verification — final choice depends on D3).
- **Frontend (TS):** `@noble/curves` (Ristretto255 via ed25519), `@noble/hashes`.
- **Backend (TS):** same as frontend, plus server-side code for registrar credential issuance.
- No dependency on heavy frameworks (ZK-SNARKs, circom, etc.) — the proofs here are discrete-log sigma protocols, small and auditable.

## Consequences

**Positive.** Every claim in ADR 0002 has a concrete, implementable, well-understood primitive behind it. No new crypto research. Dependencies are small, auditable, and available on both Go and TypeScript sides.

**Negative.** The chaincode grows: it must verify ZK proofs per ballot. Estimated verification cost is well below 10ms per ballot on modern hardware; acceptable for the target scale. Client bundle grows by the crypto library; SRI + reproducible builds required.

**Open.** None blocking implementation. A separate ADR will cover the v2 passkey upgrade path when it lands.
