# ovote

End-to-end verifiable consortium voting on Hyperledger Fabric.

> ### ⚠ Scope notice
>
> **ovote is designed for consortium and organizational voting** — unions, universities, shareholder votes, cooperatives, professional societies, political-party internal primaries, and similar private elections.
>
> **ovote is NOT fit for, and must not be used for, public government elections** (federal, state, provincial, municipal, or equivalent). The research consensus is that internet voting cannot currently be made secure for public office. Paper ballots with risk-limiting audits remain the standard. See [ADR 0001](docs/adr/0001-scope-and-compliance.md).

---

## What it is

A voting system built on four primitives:

- **Threshold ElGamal encryption** — each ballot is encrypted under a public key jointly controlled by trustees drawn from distinct consortium organizations. No single party, and no coalition below the threshold, can decrypt any individual ballot.
- **Disjunctive zero-knowledge proofs** — every submitted ballot carries a proof that each option encrypts `0` or `1`, plus a Chaum-Pedersen proof that the options sum to exactly `1`. The registrar never sees a malformed ballot, and a malicious client cannot stuff multiple votes into one envelope.
- **Homomorphic tally** — trustees jointly decrypt only the aggregate sum, recovered from the threshold-encrypted ciphertexts via Lagrange interpolation. Individual ballots are never decrypted.
- **Hyperledger Fabric bulletin board** — ballots and proofs are published to an append-only consortium ledger. No personally identifiable information is ever written on-chain. The chaincode independently re-runs the full tally crypto so a compromised admin cannot publish a fabricated result.

## Security and privacy claims

See [ADR 0002](docs/adr/0002-security-properties.md) for the full property table. In short:

- **Claimed:** ballot integrity, ballot secrecy (under threshold trust), end-to-end verifiability, immutability, eligibility/Sybil resistance, voter↔ballot non-linkability via blind-signed credentials, partial receipt-freeness.
- **Not claimed:** compromised-device resistance, coercion resistance, network-level anonymity, denial-of-service resistance, fitness for public elections.

---

## Repository layout

```
packages/
  shared/           Zod schemas + canonical JSON; type-level contract for the wire
  crypto/           Ristretto255, ElGamal, Schnorr/Chaum-Pedersen, disjunctive,
                    threshold (trusted-dealer Shamir), RSA-BSSA blind signatures
apps/
  api/              Fastify registrar — OTP auth, blind-sig issuance, ballot
                    verification, trustee bulletin board, tally publication
  web/              Vue 3 voter UI — login, ballot construction, Benaloh audit,
                    trustee partial decryption (in-browser), admin pages
chaincode/
  ovote/            Hyperledger Fabric Go contract — agenda lifecycle, ballot
                    storage, decryption-share board, full on-chain tally
                    re-verification (ports the subset of @ovote/crypto needed)
  ovote/crypto/     Go ristretto255 + Schnorr + Lagrange + dlog port; byte-
                    parity-tested against @ovote/crypto via JSON fixtures
deploy/
  compose/          Docker Compose for local API+Web (memory or fabric driver)
  fabric/           Minimal Fabric 2.5 LTS test-network (1 orderer, 2 peer orgs)
  k8s/              Reserved for production helm charts
docs/
  API.md            HTTP endpoint reference (every route, payload, rate limit)
  OPERATIONS.md     Architecture, deployment, end-to-end election walkthrough,
                    production hardening, GDPR/PIPA mapping
  DEVELOPMENT.md    Local setup with mise, common pnpm/go workflows
  adr/              Architecture Decision Records (scope, security properties,
                    crypto scheme, voter authentication, on-chain verification)
.github/workflows/  CI — typecheck, build, test (TS + Go), Docker images,
                    cross-language crypto parity check
```

---

## Quick start

Prerequisites: [`mise`](https://mise.jdx.dev/) (everything else — Node 24, Go 1.23, pnpm — is project-scoped via `.mise.toml`).

```bash
# 1. Install all toolchains and JS deps
mise install
pnpm install --frozen-lockfile

# 2. Run the test suite (TypeScript + Go)
pnpm -r --if-present test
( cd chaincode/ovote && go test ./... )

# 3. Boot the full stack locally (memory chain, no Fabric required)
cd deploy/compose
cp .env.example .env       # at minimum set OVOTE_ADMIN_BOOTSTRAP_EMAIL
docker compose up --build
# Web UI:   http://localhost:5173
# API:      http://localhost:3000
# OTP code: scroll the API logs (ConsoleMailer)
```

For the Fabric-backed flow see [`deploy/fabric/README.md`](deploy/fabric/README.md) and [`deploy/compose/README.md`](deploy/compose/README.md).

---

## Documentation index

| Audience | Read |
|---|---|
| Voters / Operators / Admin | [docs/OPERATIONS.md](docs/OPERATIONS.md) |
| Frontend / API consumers | [docs/API.md](docs/API.md) |
| Contributors | [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| Auditors / Security reviewers | [docs/adr/0002-security-properties.md](docs/adr/0002-security-properties.md), [docs/adr/0003-cryptographic-scheme.md](docs/adr/0003-cryptographic-scheme.md), [docs/adr/0005-on-chain-proof-verification.md](docs/adr/0005-on-chain-proof-verification.md) |
| Architecture overview | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |

Each major package also has its own README:
[packages/shared](packages/shared/README.md), [packages/crypto](packages/crypto/README.md), [apps/api](apps/api/README.md), [apps/web](apps/web/README.md), [chaincode/ovote](chaincode/ovote/README.md).

---

## License

Apache-2.0. See [LICENSE](LICENSE).

## Security disclosure

See [SECURITY.md](SECURITY.md).
