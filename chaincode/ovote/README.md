# ovote chaincode

Hyperledger Fabric 2.5 LTS Go contract. Append-only bulletin board for agendas, ballots, trustee decryption shares, and published tallies. **No PII** — every byte stored on chain is either an opaque base64url-encoded ciphertext / proof / signature, or non-identifying metadata (UUIDs, ISO timestamps, status enums).

## Methods

| Method | Role | What |
|---|---|---|
| `CreateAgenda(jsonBlob)` | admin | Persist a new agenda in `draft` status |
| `OpenAgenda(id)` | admin | `draft → open`; freezes the eligibility roster |
| `CloseAgenda(id)` | admin | `open → closed` |
| `CastBallot(jsonBlob)` | (no role gate; credential is the proof) | Append a ballot, reject duplicate credentials |
| `SubmitDecryptionShare(jsonBlob)` | trustee | One trustee's partial decryption + Chaum-Pedersen proof |
| `PublishResult(jsonBlob)` | admin | Persist the tally **iff** every check passes — see below |
| `GetAgenda`, `ListAgendas`, `ListBallots`, `ListDecryptionShares`, `GetResult` | public | Read paths for auditors and the API |

Every method's role gate runs through `access.go::requireRole`, which extracts the caller's `ovote.role` MSP attribute. The attribute is a comma-separated list, so a single API gateway certificate can simultaneously satisfy `admin`, `trustee`, and `voter` roles. Single-role deployments still work.

## What `PublishResult` actually verifies

This is the integrity-critical path. The chaincode does **not** trust the published counts — it re-derives them from the bulletin board:

1. **Shape sanity** — every option appears exactly once, every count is non-negative.
2. **Quorum** — every option has at least `threshold` submitted decryption shares.
3. **Counts match the box** — `Σ counts == len(ballots)`. Each ballot encodes exactly one choice (enforced per-ballot at `CastBallot` via the sum proof), so the totals must add up.
4. **Per-option crypto re-verification** — for each option:
   - Re-aggregate the option's ciphertext across every cast ballot.
   - Re-verify each submitted trustee Schnorr equality-of-DLogs proof against the agenda-registered trustee pubkey.
   - Lagrange-combine a quorum of valid shares to recover `m·G`.
   - Brute-force the small discrete log (bounded by ballot count) and compare to the published count.

A compromised admin therefore cannot publish a fabricated tally. The chain refuses any result that doesn't match what the trustees jointly decrypted from the visible bulletin board.

## Crypto port

The full crypto stack is reimplemented in `chaincode/ovote/crypto/` against `gtank/ristretto255`. It is byte-parity-tested against `@ovote/crypto` (TS) using fixtures emitted by `packages/crypto/scripts/dump-vectors.ts`. CI regenerates the fixtures every run and refuses any drift, so a TS-only crypto change cannot silently invalidate the on-chain verifier.

## File layout

```
contract.go         CreateAgenda / OpenAgenda / CloseAgenda / CastBallot /
                    SubmitDecryptionShare / PublishResult / read paths
access.go           requireRole — extracts ovote.role MSP attribute, comma-split
keys.go             Composite keys (agenda / ballot / credential nullifier /
                    decryption share / result)
model.go            Go structs mirroring packages/shared types (same JSON tags)
validate.go         Schema/format validation for incoming payloads
tally_verify.go     verifyPublishedTally — full on-chain crypto re-verification
crypto/             Go port of the @ovote/crypto subset PublishResult needs
crypto/testdata/    JSON fixtures emitted by the TS dumper, asserted byte-for-byte
*_test.go           validate, tally_verify, and crypto parity tests
```

## Building and testing

```bash
( cd chaincode/ovote && go test ./... )      # unit + parity tests
( cd chaincode/ovote && go vet ./... )       # static analysis
( cd chaincode/ovote && go build ./... )     # produces ./chaincode binary
```

For local-network testing, see [deploy/fabric/README.md](../../deploy/fabric/README.md). The `deploy/fabric/scripts/chaincode-deploy.sh` script packages, installs, approves, and commits this contract on the test network.
