# ovote

End-to-end verifiable consortium voting on Hyperledger Fabric.

> ### ⚠ Scope notice
>
> **ovote is designed for consortium and organizational voting** — unions, universities, shareholder votes, cooperatives, professional societies, political-party internal primaries, and similar private elections.
>
> **ovote is NOT fit for, and must not be used for, public government elections** (federal, state, provincial, municipal, or equivalent). The research consensus is that internet voting cannot currently be made secure for public office. Paper ballots with risk-limiting audits remain the standard. See [ADR 0001](docs/adr/0001-scope-and-compliance.md).

## What it is

A voting system built on four primitives:

- **Threshold ElGamal encryption** — each ballot is encrypted under a public key jointly controlled by trustees drawn from distinct consortium organizations. No single party (and no coalition below the threshold) can decrypt any individual ballot.
- **Disjunctive zero-knowledge proofs** — every submitted ballot carries a proof that it encrypts a well-formed vote, without revealing which option.
- **Homomorphic tally** — trustees jointly decrypt only the aggregate sum. Individual ballots are never decrypted.
- **Hyperledger Fabric bulletin board** — ballots and proofs are published to an append-only consortium ledger. No personally identifiable information is ever written on-chain.

## Security and privacy claims

See [ADR 0002](docs/adr/0002-security-properties.md) for the full property table. In short:

- **Claimed:** ballot integrity, ballot secrecy (under threshold trust), end-to-end verifiability, immutability, eligibility/Sybil resistance, voter↔ballot non-linkability, partial receipt-freeness.
- **Not claimed:** compromised-device resistance, coercion resistance, network-level anonymity, DoS resistance, fitness for public elections.

## Status

Under refactor. The current top-level layout:

```
apps/                  — web (voter UI) and api (registrar + query) — WIP
packages/              — shared crypto primitives and types — WIP
chaincode/ovote/       — Fabric smart contract — WIP
deploy/                — Fabric test network, docker-compose, k8s manifests — WIP
docs/                  — ADRs, development guide
backend-server/        — legacy (reference only)
frontend_server/       — legacy (reference only)
chaincode/chaincode.go — legacy (reference only)
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for local development setup. All runtimes are project-scoped via `mise`; nothing is installed into your global shell.

For running an election end-to-end (login flow, admin actions, trustee tally, production deployment checklist, key management) see [docs/OPERATIONS.md](docs/OPERATIONS.md). For the HTTP API reference see [docs/API.md](docs/API.md).

> ### Admin UI status
>
> v1 ships without an admin web interface. Agenda creation, opening/closing, eligibility management, and tally publication are API-only. See [docs/OPERATIONS.md](docs/OPERATIONS.md#running-an-election-end-to-end) for the curl-driven workflow.

## License

Apache-2.0. See [LICENSE](LICENSE).

## Security disclosure

See [SECURITY.md](SECURITY.md).
