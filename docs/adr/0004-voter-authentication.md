# ADR 0004 — Voter Authentication

- Status: **Accepted**
- Date: 2026-04-23
- Related: ADR 0002 (properties), ADR 0003 (cryptographic scheme)

## Context

The registrar (ADR 0002, ADR 0003) must authenticate a voter before issuing a ballot credential. The mechanism must be usable at consortium scale, resistant to phishing, and not reintroduce PII exposure on the chain.

## Decision

### Target architecture

- **Primary:** passkeys (WebAuthn). Hardware-backed, phishing-resistant, no password.
- **Fallback:** email OTP. Required for voters without passkey-capable devices.
- **Future (v3+):** OIDC/SAML SSO integration for institutional deployments that already run an IdP.

### v1 scope

**Ship email OTP only.** No passkeys in v1, no SSO in v1.

Rationale:
- Minimum implementation surface to reach a functioning end-to-end system.
- Passkey enrollment UX is non-trivial and benefits from iteration *after* the core crypto flow works.
- Email OTP is the fallback path in the target architecture, so v1's code is reused, not discarded, when passkeys are added.

### Flow (v1)

```
Voter → POST /auth/otp/request { email }
  Registrar: rate-limit (per IP, per email); generate 6-digit OTP; store hashed OTP + TTL;
             send email via transactional provider; respond 202 (no existence disclosure).

Voter → POST /auth/otp/verify { email, otp }
  Registrar: constant-time compare hashed OTP; if valid, issue short-lived session token;
             invalidate OTP on success OR after N attempts.

Voter (authenticated) → POST /ballots/credential/request { blindedToken, agendaId }
  Registrar: verify session; verify voter eligible for agendaId; check not already issued for agendaId;
             blind-sign blindedToken; mark "credential issued" for (voter, agenda) in registrar DB;
             return blindSignature.

Voter (client-side): unblind → obtain anonymous credential σ.
```

### Anti-abuse requirements

- Rate limits on `/auth/otp/request`: per-IP, per-email, per-minute and per-hour.
- Rate limits on `/auth/otp/verify`: linear backoff; lock after N failures.
- OTP is single-use, short TTL (≤ 10 minutes), hashed at rest.
- No user enumeration: `/auth/otp/request` returns 202 regardless of whether the email exists.
- Session tokens: short-lived, httpOnly + Secure + SameSite=Strict cookie, rotated on privilege change.
- Registrar never logs OTP values.

### Privacy boundaries

- The registrar learns: voter identity, email, that a credential was issued for an agenda.
- The registrar does NOT learn: the unblinded credential value `σ`, the voter's ciphertext, the voter's chosen option.
- The bulletin board (Fabric) learns: `σ`, ciphertext, proof. It does NOT learn voter identity.
- These boundaries are enforced by code, not convention: the registrar process holds no decryption material for ballots; the chaincode holds no voter identity data.

## Consequences

**Positive.** Minimum viable auth; simplest shippable flow; no architectural rework needed to add passkeys in v2.

**Negative / accepted.** Email OTP is weaker than passkeys (email account takeover = vote). Operators must communicate this risk to voters and consider scoping v1 pilots accordingly.

**Follow-ups.** ADR-0005 (passkey enrollment) before v2. ADR-0006 (OIDC/SAML integration) before v3 institutional pilots.
