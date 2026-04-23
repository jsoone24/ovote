# ADR 0002 — Claimed Security and Privacy Properties

- Status: **Accepted**
- Date: 2026-04-23
- Related: ADR 0001 (scope), ADR 0003 (cryptographic scheme)

## Context

Online voting systems are evaluated against a standard set of properties. A system must state which properties it claims, at what strength, and — equally important — which it does not claim. Overclaiming is the single most common failure mode of voting-system design documents.

## Decision

### Properties claimed

| Property | Strength | Mechanism |
|---|---|---|
| **Ballot integrity** | Strong | Fabric consortium ledger; append-only; multi-org endorsement policy; chaincode validates ballot well-formedness and ZK proof of valid plaintext before writing. |
| **Ballot secrecy** | Strong under the trustee threshold assumption | Each ballot encrypted under a threshold public key held by `t`-of-`n` trustees drawn from distinct consortium orgs. No single party (and no coalition smaller than `t`) can decrypt any individual ballot. Individual ballots are never decrypted at any point; only the homomorphic aggregate is. |
| **End-to-end verifiability (E2E-V)** | Full (cast-as-intended, recorded-as-cast, tallied-as-recorded) | Benaloh cast-or-challenge in the client (cast-as-intended). Voter-visible verifier code on the public bulletin board (recorded-as-cast). Universally verifiable tally proof published by trustees (tallied-as-recorded). |
| **Immutability** | Strong | Fabric ledger, cross-org endorsement, immutable history per channel. |
| **Eligibility / Sybil resistance** | Strong | Each eligible voter receives exactly one anonymous ballot credential from the registrar. Chaincode rejects ballots without a valid, unspent credential. |
| **Non-linkability (voter ↔ ballot)** | Strong | PII is stored only in the off-chain registrar database. The bulletin board contains only anonymous ballot credentials and ciphertexts. No record on-chain references a voter identity directly. |
| **Receipt-freeness** | **Partial** | Benaloh cast-or-challenge reduces receipt utility. Not provably receipt-free in the full cryptographic sense. |
| **Coercion resistance** | **Not claimed** | Ballots are one-shot (see ADR 0003 D4). We do not claim cryptographic or procedural coercion resistance. Operators must advise voters to cast in private. |

### Properties explicitly **not** claimed

| Non-property | Why we cannot claim it |
|---|---|
| **Compromised-device resistance** | If the voter's browser/OS is compromised, the adversary sees the vote in plaintext before encryption. No server-side design can prevent this. |
| **Any coercion resistance** | Re-voting (the only available online mitigation) was rejected to keep the one-shot mental model and chaincode simple. JCJ-grade fake-credential schemes introduce unacceptable UX complexity. Operators MUST communicate to voters: cast in a private environment. |
| **Network-level anonymity** | We do not operate over Tor by default. An adversary with network-tap access and timing correlation can link IP → ballot-submission. Operators SHOULD recommend Tor or similar for adversarial environments; this is an operational mitigation, not a cryptographic guarantee. |
| **Denial-of-service resistance during voting** | Standard web-scale DoS mitigations apply; this is an availability property, not a voting-specific cryptographic one. |
| **Fitness for public government elections** | See ADR 0001. |

### Data-protection posture

- **PII never on-chain.** Names, emails, organization membership, voter-registry data live exclusively in the off-chain registrar database.
- **On-chain contains only:** anonymous ballot credentials (one-time-use), ciphertexts, ZK proofs, trustee keys, agenda metadata, tally proofs.
- **GDPR erasure compatibility:** erasure applies to the off-chain registrar record. The on-chain anonymous credential is not PII on its own (no direct or reasonable re-identification), and therefore is not subject to erasure.
- **Separation of duties:** the *registrar* (issues credentials, knows who voted) and the *tallier* (threshold-decrypts the aggregate) are architecturally and operationally distinct. A registrar cannot decrypt votes; a tallier does not learn voter identities.
- **Coarse-grained on-chain timestamps:** ballot submission times are bucketed (default: nearest minute) to frustrate timing-correlation attacks.
- **Analytics:** no per-voter or per-agenda drill-down analytics beyond published aggregate tallies.

### Feature implications (dropped or restricted)

- A persistent "my voted agendas" list in the user profile is **dropped**. Linking identity to participation (even without the choice) is a privacy leak inconsistent with the claims above. Voters may save their own verifier codes client-side.
- Admin "who voted" visibility per agenda is **restricted** to aggregate turnout counts; no voter list per agenda.
- Admin cannot modify an agenda once voting has opened (inherited constraint from the original design; kept).

## Consequences

**Positive.**

- The claim set is defensible, implementable, and matches what the best-understood online voting schemes actually achieve.
- The non-claims are explicit, which protects both users and operators.

**Negative / accepted.**

- Some previously planned features (voter history, admin analytics) are reduced or removed.
- Receipt-freeness and coercion resistance remain partial; operators must communicate this honestly to voters.

**Unresolved.**

- Concrete parameter choices for the cryptographic primitives are deferred to ADR 0003.
- Voter-authentication mechanism (passkeys, OTP, SSO) is deferred to a separate ADR after ADR 0003.
