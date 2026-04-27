# ovote — HTTP API reference

All endpoints return JSON. Authenticated endpoints expect `Authorization: Bearer <token>` where the token comes from `POST /auth/otp/verify`.

Rate limits below are per-IP and enforced by `@fastify/rate-limit`. A global floor of 300/min applies to anything not listed. Exceeding a limit returns `429 Too Many Requests`.

## Auth

### `POST /auth/otp/request`
Send a one-time login code to `email`. 5/min.

```json
{ "email": "voter@example.org" }
```

Response: `202 { "status": "otp-sent" }`.

In development (no `OVOTE_SMTP_URL`) the code is logged by the API instead of emailed.

### `POST /auth/otp/verify`
Exchange a 6-digit code for a session token. 10/min. After 5 wrong codes the OTP is purged.

```json
{ "email": "voter@example.org", "code": "123456" }
```

Response:
```json
{
  "sessionToken": "…base64url (32 bytes entropy)…",
  "voter": { "id": "…uuid…", "email": "…", "role": "voter|admin|trustee" }
}
```

### `POST /auth/logout`
Revokes the session token in the `Authorization` header. Always returns `200 { "status": "logged-out" }`.

---

## Agendas

### `GET /agendas`
Public. Lists every agenda.

### `GET /agendas/:id`
Public. Returns one agenda, or 404.

### `POST /agendas` — admin only
Creates an agenda in `draft` state and returns it with the per-agenda blind-signing public key.

```json
{
  "title": "Board election",
  "description": "",
  "openAt":  "2026-05-01T09:00:00Z",
  "closeAt": "2026-05-01T18:00:00Z",
  "options": [
    { "id": "alice", "label": "Alice" },
    { "id": "bob",   "label": "Bob" }
  ],
  "key": {
    "groupPk":   "…base64url Ristretto point…",
    "threshold": 2,
    "n":         3,
    "trustees":  [
      { "index": 1, "pk": "…" },
      { "index": 2, "pk": "…" },
      { "index": 3, "pk": "…" }
    ]
  }
}
```

Response: `201 <Agenda>` where `registrarBlindPk` is the SPKI-encoded RSA public key voters use to blind-sign credentials against this agenda.

### `POST /agendas/:id/open` — admin only
Transitions `draft → open`.

### `POST /agendas/:id/close` — admin only
Transitions `open → closed`.

### `POST /agendas/:id/eligibility` — admin only
Appends voters to the eligibility roster. **Only allowed while the agenda is in `draft`** — after open the roster is frozen and this returns `409`.

```json
{ "emails": ["voter1@org.test", "voter2@org.test"] }
```

Response: `200 { "added": <number> }`.

---

## Credentials

### `POST /credentials/blind-sign` — voter (session required)
Voter sends a blinded message, registrar returns the blind signature. Requires the caller to be on the eligibility roster for `agendaId`. 10/min. One credential per voter per agenda.

```json
{ "agendaId": "…uuid…", "blindedMessage": "…base64url…" }
```

Response: `200 { "blindSignature": "…base64url…" }`.

**Retry semantics.** The first successful call persists `(blindedMessage, blindSignature)`. Replaying the exact same request returns the stored signature unchanged — so a dropped HTTP response never locks the voter out. A second call with a *different* `blindedMessage` returns `409`, keeping the one-credential-per-voter-per-agenda invariant.

---

## Ballots

### `POST /ballots`
**No session required.** The credential is the eligibility proof; requiring a session would reintroduce a linkability vector. 30/min per IP.

```json
{
  "id":       "…uuid…",
  "agendaId": "…uuid…",
  "options":  [ /* one per agenda option, each with ciphertext and disjunctive ZKP */ ],
  "sumProof": {
    "commitment": "…base64url A.B…",
    "response":   "…base64url scalar…"
  },
  "credential": {
    "nonce":     "…base64url prepared credential nonce…",
    "signature": "…base64url RSA-BSSA signature…"
  },
  "castAt":     "2026-05-01T12:34:56Z",
  "transcript": "{…voter audit transcript…}"
}
```

The API re-runs every disjunctive proof and the `sumProof` (a Chaum-Pedersen equality-of-DLogs proof that the homomorphic sum of every option ciphertext encrypts exactly `1`) inside [services/ballot-verifier.ts](../apps/api/src/services/ballot-verifier.ts) before forwarding to the chain. Without `sumProof` a malicious client could submit all-zero or all-one ballots — each individual option proof would still pass, but the tally would be skewed. Duplicate credentials are rejected on-chain (`409`).

Response: `201 { "id": "…", "status": "recorded" }`.

### `GET /ballots/:agendaId`
Public. Returns every ballot for the agenda (so auditors can re-run the tally themselves).

---

## Trustee bulletin board

### `GET /agendas/:agendaId/aggregate`
Public. Returns the per-option homomorphic sum of every ballot's ciphertext — the input to partial decryption.

### `POST /decryption-shares` — trustee only
Submits one trustee's partial decryption for one option. The API verifies the Chaum-Pedersen proof before forwarding to the chain; malformed shares are rejected with `400`.

```json
{
  "share": {
    "agendaId":     "…uuid…",
    "optionId":     "alice",
    "trusteeIndex": 1,
    "share":        "…base64url Ristretto point…",
    "proof":        { "commitment": "…", "response": "…" },
    "submittedAt":  "2026-05-01T20:00:00Z"
  }
}
```

### `GET /decryption-shares/:agendaId`
Public. Lists all submitted shares for the agenda.

---

## Results

### `POST /results/publish` — admin only
Combines submitted trustee shares off-chain (no secrets involved — just Lagrange interpolation over Ristretto points), solves a small discrete log per option, and writes the tally to the chain. The chain (both the in-memory driver and the Fabric chaincode) independently enforces two checks before persisting the tally:

1. each option has at least `threshold` submitted decryption shares, and
2. the counts sum to the total number of ballots cast on the bulletin board (every ballot encodes exactly one choice, bound by the per-ballot sum proof).

Together these refuse any tally whose shape contradicts the bulletin board, so a compromised admin identity cannot publish a fabricated result. Full re-verification of the Lagrange interpolation and discrete-log decoding on-chain requires porting ristretto255 + Schnorr verification to Go — see `docs/OPERATIONS.md`. Fails with `409` if the quorum or total-count check fails.

```json
{ "agendaId": "…uuid…" }
```

Response: `201 <TallyProof>`.

### `GET /results/:agendaId`
Public. Returns the published tally.

---

## Admin

These endpoints back the `/admin` web UI and are gated by `role === 'admin'`.

### `GET /admin/voters` — admin only
Lists every registered voter so the admin UI can render the role-management table.

Response:
```json
{
  "voters": [
    { "id": "…uuid…", "email": "alice@org.test", "role": "admin" },
    { "id": "…uuid…", "email": "bob@org.test",   "role": "voter" }
  ]
}
```

### `POST /admin/voters/role` — admin only
Promotes or demotes a voter. The voter must already exist (they're created on first OTP login); the admin flips their role here.

```json
{ "email": "bob@org.test", "role": "trustee" }
```

Response: `200 { "voter": { "id": "…", "email": "…", "role": "trustee" } }`. `404` if the email is not registered.

### `GET /admin/agendas/:agendaId/eligibility` — admin only
Returns the current eligibility roster for an agenda, emails included, so the admin UI can show who's been added.

Response:
```json
{
  "voters": [
    { "voterId": "…uuid…", "email": "alice@org.test" }
  ]
}
```

---

## Error shape

```json
{ "error": "human-readable message" }
```

Common codes:

| Code | Meaning |
|------|---------|
| 400  | Request failed schema validation or crypto verification |
| 401  | Missing/invalid session |
| 403  | Role missing, or voter not on roster |
| 404  | Agenda / resource not found |
| 409  | State conflict (wrong phase, duplicate credential, duplicate ballot, not enough shares, …) |
| 429  | Rate limit exceeded |
| 500  | Chain or internal error |

---

## Type definitions

Source of truth lives in [packages/shared](../packages/shared/src) — `domain.ts` for TypeScript types, `schemas.ts` for the Zod validators. The frontend and backend import the same definitions, so schema drift is caught at build time.
