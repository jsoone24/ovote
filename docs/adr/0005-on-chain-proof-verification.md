# ADR 0005: On-chain ZK proof verification

- Status: Accepted
- Date: 2026-04-23

## Context

Ballots carry disjunctive Chaum-Pedersen proofs; decryption shares carry
Chaum-Pedersen equality-of-DL proofs; credentials carry RSA blind signatures.
Verifying these inside chaincode would require a Go implementation of
Ristretto255 and SHA-256-based scalar hashing identical to the client, plus
RSA-PSS verification for blind signatures.

For v1 we want the simplest functioning system.

## Decision

- v1: the registrar API verifies all proofs before writing to the bulletin
  board. Chaincode enforces storage invariants (schema shape, time window,
  credential uniqueness, caller MSP authority). All proof bytes are stored
  on-chain verbatim, so any voter or auditor can re-verify the full transcript
  offline using the public `@ovote/crypto` package. E2E-V is preserved end to
  end: a malicious registrar cannot forge valid proofs, only withhold ballots,
  which public inclusion receipts expose.

- v2: port verification primitives to Go (Ristretto255 via `gtank/ristretto255`,
  RSA-PSS via stdlib) and move proof checks into chaincode, so the chain
  itself rejects invalid ballots on submission.

## Consequences

+ v1 chaincode stays small, reviewable, and easy to package.
- Weaker real-time guarantee: invalid ballots may briefly sit on-chain until
  audit tooling catches them. Documented in threat model and the voter client
  re-verifies every posted ballot before trusting the tally.
- The proof format is frozen at v1 (b64url serialized scalars and points plus
  RFC 8785 canonical JSON transcripts); v2 Go verifier must match bit-for-bit.
