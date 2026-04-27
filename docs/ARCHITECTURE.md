# Architecture

This document is the system-level orientation guide. It complements the operational walkthrough in [OPERATIONS.md](OPERATIONS.md) and the ADRs under [adr/](adr/) — read those for the *why* behind each decision; this file covers the *what* and *where*.

---

## High-level data flow

```
                        ┌────────────────────────────┐
                        │      Voter (browser)       │
                        │  apps/web (Vue 3 + Vite)   │
                        └──────────────┬─────────────┘
                                       │
       OTP login, blind-sign request,  │ HTTPS / fetch
       ballot cast, audit, trustee     │
       partial decryption              │
                                       ▼
       ┌─────────────────────────────────────────────────────────┐
       │                Registrar API (apps/api)                 │
       │   Fastify 5 · Node 24 · sqlite (better-sqlite3)         │
       │                                                         │
       │  • OTP issue / verify        • blind-sig issuance       │
       │  • session token mgmt        • ballot verification (ZK) │
       │  • role gate (admin/        • trustee bulletin board    │
       │    trustee/voter)            • tally combination + pub  │
       │                                                         │
       │  Stateful only for OTPs, sessions, voter directory,     │
       │  eligibility roster, encrypted blind-signing RSA key.   │
       └─────────────┬─────────────────────────────┬─────────────┘
                     │                             │
   sqlite (volatile, │                             │ @hyperledger/fabric-gateway
   PII layer — GDPR/ │                             │ (gRPC, mTLS)
   PIPA erasure here)│                             ▼
                     │            ┌────────────────────────────────────┐
                     │            │     Hyperledger Fabric channel     │
                     │            │       (deploy/fabric, prod = HA    │
                     │            │        consortium peers + orderer) │
                     │            │                                    │
                     │            │   chaincode/ovote (Go contract)    │
                     │            │   • agendas, ballots, shares,      │
                     │            │     tallies — append-only, no PII  │
                     │            │   • on-chain crypto re-verifies    │
                     │            │     every published tally          │
                     │            └────────────────────────────────────┘
                     │
                     ▼
       ┌─────────────────────────────────────────────────────────┐
       │              shared crypto + types                      │
       │   packages/shared  ── Zod schemas, canonical JSON       │
       │   packages/crypto  ── Ristretto255 / Schnorr / threshold│
       │                       ElGamal / RSA-BSSA blind sigs     │
       │   chaincode/ovote/crypto  ── Go port, byte-parity-tested│
       └─────────────────────────────────────────────────────────┘
```

---

## Components and what each one owns

### `packages/shared`

The wire-format contract. TypeScript types (`Agenda`, `Ballot`, `TallyProof`, …) and the matching Zod schemas. Compile-time `Equal<>`/`Expect<>` assertions guarantee the inferred and declared types stay in sync. Also exports canonical-JSON encoding for any place a deterministic byte representation is required (Fiat-Shamir transcripts, voter audit trails).

Consumers: `apps/api`, `apps/web`. The Go chaincode hand-rolls equivalent types (`chaincode/ovote/model.go`) using the same JSON tags so the wire format is identical.

### `packages/crypto`

Pure-functional crypto library. No I/O, no side effects, no platform dependencies beyond `@noble/curves` and Web Crypto. Each module is one primitive:

| Module | What |
|---|---|
| `ristretto.ts` | Ristretto255 group ops, scalar field, base64url codecs |
| `hash.ts` | Domain-separated hash-to-scalar (Fiat-Shamir source) |
| `elgamal.ts` | Additively-homomorphic ElGamal over Ristretto255 |
| `schnorr.ts` | Schnorr proof-of-knowledge and Chaum-Pedersen equality-of-DLogs |
| `disjunctive.ts` | OR-proofs for "this ciphertext is in {ZERO·G, …, k·G}" |
| `threshold.ts` | Trusted-dealer Shamir keygen, partial decryption, Lagrange recombination |
| `blind-signature.ts` | RSA-BSSA blind signatures (RFC 9474) |

Anything that depends on byte-level transcripts has a Go counterpart; see *Cross-language parity* below.

### `apps/api` — Registrar

Fastify server that owns:

- the **identity layer**: voters, eligibility, sessions, OTP codes (HMAC-peppered with `OVOTE_SECRET_KEY`)
- the **blind-signing layer**: per-agenda RSA key, encrypted at rest with AES-256-GCM
- the **verification layer**: every ballot's disjunctive proofs, sum proof, and credential signature get re-checked before forwarding to the chain
- the **trustee bulletin board**: aggregates per-option ciphertexts (homomorphic sum) and forwards trustee partial-decryption shares to the chain
- the **tally combiner**: off-chain Lagrange + small-dlog to produce the published count, which the chaincode then independently re-verifies

Routes are split by concern: `auth`, `agendas`, `credentials`, `ballots`, `trustees`, `results`, `admin`. Middleware in `src/middleware/auth.ts` provides `requireSession` and `requireRole`.

Storage is SQLite via `better-sqlite3` with additive migrations in `src/db.ts`. The DB never holds long-term state of cryptographic interest — losing it loses pending OTP codes and session tokens but no ballots or trustee material.

### `apps/web` — Voter UI

Vue 3 + vue-router 4. Two areas:

- **Voter flow.** Login (OTP) → list agendas → vote (browser-side ballot construction with Benaloh challenge) → see result.
- **Trustee flow.** Closed agendas show a trustee panel that runs partial decryption *in the browser*, so the trustee secret share never reaches the network.
- **Admin pages.** Behind `role === 'admin'` router guard. Create agenda (which generates a fresh threshold key in-browser via trusted-dealer keygen — secret shares are displayed exactly once and never leave the page), open/close/publish, manage eligibility, manage user roles.

Session token lives in `sessionStorage` (cleared when the tab closes). The `apps/web/src/api.ts` client is the only place that talks to the backend.

### `chaincode/ovote` — Hyperledger Fabric Go contract

Append-only bulletin board. Stores:

- agendas (status, options, threshold key parameters, registrar blind-sig pubkey)
- ballots (encrypted ciphertexts + disjunctive + sum proofs + blind-signed credential)
- decryption shares (per option per trustee, with Schnorr proof)
- published tallies

Access control is attribute-based: each chaincode method declares which `ovote.role` it needs (admin, trustee, voter), and `chaincode/ovote/access.go` matches it against the comma-separated role list on the caller's MSP certificate.

`PublishResult` re-runs the full tally crypto on-chain via `chaincode/ovote/crypto`. It re-aggregates each option's ciphertexts, re-verifies every submitted Schnorr proof, Lagrange-combines a quorum of valid shares, brute-forces the small discrete log, and confirms the recovered count matches the published one. A compromised admin therefore cannot publish a fabricated tally even if the off-chain combiner is malicious.

### `chaincode/ovote/crypto` — Go port

The minimum subset of `@ovote/crypto` the chaincode needs to do `PublishResult` end-to-end:

- ristretto255 group ops via `gtank/ristretto255`
- `HashToScalar` matching the TS Fiat-Shamir construction byte-for-byte
- `VerifyEqualityOfDiscreteLogs` (the Schnorr verifier the trustees' shares carry)
- `LagrangeCoefficient` + `CombineShares`
- linear small-dlog solver, bounded by ballot count

Byte parity with the TS reference is asserted by `crypto_test.go`, which loads JSON fixtures emitted by `packages/crypto/scripts/dump-vectors.ts`. CI regenerates the fixtures every run and fails on any diff, so a TS-only crypto change cannot silently invalidate the chaincode.

---

## Cross-language parity (TS ↔ Go)

The single biggest risk in this design is byte-level disagreement between the two crypto implementations. If the chaincode hashes one way and the TS reference hashes another way, the chain's tally re-verification would silently disagree with auditors, and nobody would notice until forensic time.

We mitigate this with three layers:

1. **One source of truth for the construction.** The TS module is canonical. The Go port copies it line-for-line, with comments pointing at the original.
2. **Deterministic golden vectors.** `packages/crypto/scripts/dump-vectors.ts` runs the TS primitives over fixed inputs (with a seeded PRG that overrides `crypto.getRandomValues` so re-runs produce identical bytes) and writes the expected outputs to `chaincode/ovote/crypto/testdata/vectors.json`. The Go test reads the JSON and asserts.
3. **CI drift guard.** Every CI run regenerates the fixture and `git diff --exit-code`s. Any TS-side change that affects outputs without a matching fixture refresh fails the build.

To regenerate the fixture intentionally:

```bash
pnpm --filter @ovote/crypto exec tsx scripts/dump-vectors.ts \
  chaincode/ovote/crypto/testdata/vectors.json
```

---

## Trust boundaries

| Boundary | What's trusted | What's not |
|---|---|---|
| Voter device → API | The voter's device, the TLS endpoint, the API certificate | The voter's network |
| API → chaincode | The API's `ovote.role` cert, mutual TLS to the peer | The off-chain DB if it leaks |
| Trustees → chaincode | The Schnorr proof on each share | The trustees' off-chain combiner |
| Auditors → public bulletin board | The chaincode's verifier | Any single trustee |

Notably:

- The **API runs ballot verification client-side equivalently**: every check the registrar does is something a voter (or third-party auditor) can re-run from the same data, using the same `@ovote/crypto` library.
- The **chaincode runs tally verification chain-side equivalently**: even if the API and the admin collude on a bad tally, the chain refuses to persist it.
- The **voter's identity** never appears on chain; the link from "voter X cast a vote" to "this ballot exists" is broken by the blind signature, which is the only credential the chaincode sees.

---

## Configuration surface

All knobs are environment variables, validated by Zod at boot (`apps/api/src/config.ts`). The most important ones:

| Variable | Purpose |
|---|---|
| `OVOTE_CHAIN_DRIVER` | `memory` (dev) or `fabric` (prod) |
| `OVOTE_SECRET_KEY` | 32-byte base64url; pepper for OTP HMAC + AES-GCM key for RSA envelope. **Rotate carefully** — see OPERATIONS.md |
| `OVOTE_CORS_ORIGINS` | Comma-separated allowlist; default `*` for dev — pin in production |
| `OVOTE_TRUST_PROXY` | `false` / `true` / hop-count / CIDR. Mis-setting bypasses IP rate limits |
| `OVOTE_ADMIN_BOOTSTRAP_EMAIL` | First admin promoted to `admin` role on boot |
| `OVOTE_FABRIC_*` | Fabric gateway config; only consumed when driver=fabric |

Defaults in `deploy/compose/.env.example` are dev-safe; production deployments must override CORS, trust-proxy, and the secret key.
