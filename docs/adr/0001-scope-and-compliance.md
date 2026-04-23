# ADR 0001 — Scope and Compliance Target

- Status: **Accepted**
- Date: 2026-04-23
- Supersedes: —
- Related: ADR 0002 (security properties), ADR 0003 (cryptographic scheme)

## Context

The project is a refactor and hardening of an older graduation-project voting system that used a Hyperledger Fabric consortium blockchain plus a salted-hash anonymization pattern. The refactor aims to bring the system to a deployable standard, with security and privacy prioritized over features.

During design review, the question of "presidential-election-level" fitness was raised. The cryptography and election-security research consensus is unambiguous: **internet voting is not currently fit for public government elections of any scale.** The blocking issues (client-device compromise, coercion in uncontrolled environments, authentication at national scale, inability to recover from a compromise) cannot be solved by cryptography alone. Germany, the Netherlands, Norway, and France have audited internet voting for public office and withdrawn it; most U.S. states prohibit it; only Estonia operates it for public elections, and its use remains academically contested.

Attempting to market or position this system as suitable for a public government election would be dishonest and could cause real harm if deployed.

## Decision

**In-scope deployments:**

- Private/consortium voting for organizations: unions, universities, student governments, shareholder votes, cooperatives, professional societies, political-party internal primaries, homeowners' associations, condominium boards, corporate board elections.

**Out-of-scope explicitly:**

- Any public government election (federal, state, provincial, municipal, referenda, judicial retention, or equivalent in any jurisdiction).
- Any election whose outcome determines the allocation of state power or public office.

**Legal compliance targets** (overlapping supersets, all must be met):

1. **PIPA** (Republic of Korea, *개인정보 보호법*): lawful basis, data minimization, cross-border transfer rules, data subject rights (access, correction, deletion).
2. **GDPR** (EU 2016/679): lawful basis (Art. 6), special-category protection if political opinions can be inferred (Art. 9), data subject rights including erasure (Art. 17), DPIA requirement (Art. 35), data minimization and purpose limitation.
3. **U.S. state data-privacy laws** where applicable (CCPA/CPRA, state breach-notification statutes). Note: U.S. *election* law is not a compliance target because public elections are out-of-scope; the operator is responsible for confirming no public-election statute applies to their use.

**Operating posture:**

- The top of the repository README and product-facing documentation must carry a prominent disclaimer: *"This system is designed for consortium and organizational voting. It is not fit for, and must not be used for, public government elections."*
- A DPIA (Data Protection Impact Assessment) must be completed and filed before any live deployment involving real voter data.
- An external penetration test must be completed before any live deployment.

## Consequences

**Positive.**

- The compliance surface becomes concrete and achievable.
- The cryptographic design (ADR 0003) can be scoped to properties achievable in a browser/web context, without pretending to solve open research problems.
- Honest marketing protects users, operators, and the project's maintainers from reputational and legal harm.

**Negative / accepted trade-offs.**

- Some users who want a "government-grade" system will find this unsuitable, and we will not pretend otherwise.
- The disclaimer and DPIA overhead adds friction to adoption — this is intentional.

**Unresolved.**

- Whether the project will be published as open source; if so, the scope disclaimer must appear in the repository README, on any landing page, and in package metadata.
