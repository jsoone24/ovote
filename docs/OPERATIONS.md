# ovote — operations guide

This document covers everything needed to **run, test, and operate** an ovote deployment. It is written for the administrator (the person setting up an election) and the operator (the person running the infrastructure). Voter-facing information lives in the README.

## Contents

1. [Architecture at a glance](#architecture-at-a-glance)
2. [Local development](#local-development)
3. [Roles and how to assign them](#roles-and-how-to-assign-them)
4. [Logging in](#logging-in)
5. [Running an election end-to-end](#running-an-election-end-to-end)
6. [Web UI coverage](#web-ui-coverage)
7. [Testing](#testing)
8. [Production deployment](#production-deployment)
9. [Key management](#key-management)
10. [Known limitations and security notes](#known-limitations-and-security-notes)

---

## Architecture at a glance

```
 Voter browser ──(HTTPS)──▶ Registrar API (Fastify)  ──gRPC──▶ Fabric peer
                              │                                    │
                              ├─ SQLite   (voters, sessions, OTP)   └─ chaincode/ovote
                              └─ SMTP     (OTP email)                  (agendas, ballots,
                                                                        decryption shares,
                                                                        tally)
```

- **Registrar API** ([apps/api](../apps/api)) — issues OTP login, blind-signs credentials, forwards verified ballots to the chain, verifies decryption-share proofs, combines trustee shares at tally time.
- **Web client** ([apps/web](../apps/web)) — voter-facing Vue 3 SPA. All sensitive cryptography runs locally (disjunctive proof on the ballot, partial decryption for trustees).
- **Chaincode** ([chaincode/ovote](../chaincode/ovote)) — the public bulletin board. Stores only encrypted ciphertexts, proofs, and published tallies. No PII.
- **Crypto** ([packages/crypto](../packages/crypto)) — Ristretto255 ElGamal, threshold ElGamal with Chaum-Pedersen proofs, disjunctive ZKPs, RSA-BSSA blind signatures. Shared between browser and server.

---

## Local development

**Prereqs:** macOS or Linux, [mise](https://mise.jdx.dev) (`brew install mise`).

```bash
cd <repo-root>
mise trust                          # review .mise.toml
mise run bootstrap                  # installs Node 24, Go 1.26, activates pnpm
mise exec -- pnpm install           # workspace deps
mise exec -- pnpm -r run build      # build @ovote/shared and @ovote/crypto (other workspaces rebuild on demand)
```

Open two terminals:

```bash
# terminal 1 — API on :3000, memory-backed chain, ConsoleMailer
mise exec -- env OVOTE_ADMIN_BOOTSTRAP_EMAIL=admin@example.test \
  pnpm --filter @ovote/api run dev

# terminal 2 — web on :5173 (proxies /api to :3000)
mise exec -- pnpm --filter @ovote/web run dev
```

Open http://localhost:5173 in a browser.

> **Dev mailer gotcha.** With `OVOTE_SMTP_URL` unset, OTP codes are **not emailed** — they're printed to the API terminal as `WARN OTP (dev mailer — do NOT run in production) { email, code }`. Grab the 6-digit `code` from there.

---

## Roles and how to assign them

ovote has three roles. They are intentionally asymmetric because they correspond to different trust scopes.

| Role      | How to assign                                                      | Scope of power                                                 |
|-----------|--------------------------------------------------------------------|----------------------------------------------------------------|
| `voter`   | Automatic on first OTP login                                       | Cast one ballot per agenda they're eligible for                |
| `admin`   | Boot-time via `OVOTE_ADMIN_BOOTSTRAP_EMAIL`, or direct DB update   | Create/open/close agendas, manage eligibility, publish results |
| `trustee` | Direct DB update (see below)                                       | Submit decryption shares                                       |

### Bootstrap the first admin

Set `OVOTE_ADMIN_BOOTSTRAP_EMAIL=admin@example.test` in the environment. On boot the API upserts that voter and sets `role='admin'`. Log in with the same email to claim the role.

### Promote an existing voter to admin or trustee

There is no API for role elevation (intentional — admin provisioning happens out-of-band). Do it via SQLite:

```bash
sqlite3 /path/to/ovote-api.sqlite \
  "UPDATE voters SET role = 'trustee' WHERE email = 'trustee-1@example.test';"
```

For Fabric deployments, the on-chain access control is separate — it keys off MSP attributes (`ovote.role=admin|trustee|registrar`), see [chaincode/ovote/access.go](../chaincode/ovote/access.go). The API-level role gate and the chaincode-level role gate are independent; both must authorize a privileged call.

---

## Logging in

### Web UI

1. Visit http://localhost:5173 → click **sign in**.
2. Enter your email → **request code**.
3. **Dev:** read the 6-digit code from the API terminal. **Prod:** check email inbox.
4. Enter the code → you're logged in. The session token and role are held in `sessionStorage` (cleared when the tab closes) so that session state does not persist across browser windows.

### API (curl)

```bash
# 1. Request OTP
curl -X POST http://localhost:3000/auth/otp/request \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.test"}'
# → 202 { "status": "otp-sent" }

# 2. Verify and pick up token (grab code from API logs in dev)
curl -X POST http://localhost:3000/auth/otp/verify \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.test","code":"123456"}'
# → 200 { "sessionToken": "…", "voter": { … } }

# 3. Use the token for authenticated calls
TOKEN=…
curl -H "authorization: Bearer $TOKEN" http://localhost:3000/agendas
```

Tokens expire after `OVOTE_SESSION_TTL_MINUTES` (default 60). To revoke early: `POST /auth/logout` with the bearer token.

Rate limits:

| Endpoint                     | Limit               |
|------------------------------|---------------------|
| `POST /auth/otp/request`     | 5/min per IP        |
| `POST /auth/otp/verify`      | 10/min per IP       |
| `POST /credentials/blind-sign` | 10/min per IP      |
| `POST /ballots`              | 30/min per IP       |
| Everything else              | 300/min per IP      |

After 5 wrong OTP codes for the same email, the OTP is purged and the voter has to request a new one.

---

## Running an election end-to-end

Admin actions are available both through the web UI (sign in as a user with the `admin` role and use the `/admin` pages) and through the HTTP API. The scripted example below is the API path — useful for automation, CI fixtures, and internal tooling. The web UI hits the same endpoints.

### 1) Generate the threshold key (one-off, trustees must do this together)

Open a browser console on a machine the trustees trust — they run this themselves:

```js
// Paste the @ovote/crypto bundle or use the dev console of the voter app
const { Threshold, Ristretto } = window.__OVOTE_CRYPTO__;  // exposed in dev builds
const { publicParams, shares } = Threshold.trustedDealerKeygen(2, 3);
// Each trustee takes ONE share and stores the hex-encoded secret share securely.
// The `publicParams` block goes to the admin to paste into the agenda create call.
```

> In the current build the key is generated via a trusted dealer. A real deployment should swap in DKG (distributed key generation) so no single party ever holds all shares. See ADR 0003.

### 2) Admin creates the agenda (draft state)

```bash
curl -X POST http://localhost:3000/agendas \
  -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{
    "title": "Board election 2026",
    "description": "",
    "openAt": "2026-05-01T09:00:00Z",
    "closeAt": "2026-05-01T18:00:00Z",
    "options": [
      {"id":"alice","label":"Alice"},
      {"id":"bob","label":"Bob"}
    ],
    "key": {
      "groupPk": "<base64url Ristretto point from Threshold.trustedDealerKeygen>",
      "threshold": 2,
      "n": 3,
      "trustees": [
        {"index":1,"pk":"<pk share 1>"},
        {"index":2,"pk":"<pk share 2>"},
        {"index":3,"pk":"<pk share 3>"}
      ]
    }
  }'
# → 201 { id, registrarBlindPk, … }
```

### 3) Admin seeds the eligibility roster (must be draft)

```bash
curl -X POST http://localhost:3000/agendas/$AGENDA_ID/eligibility \
  -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"emails":["voter1@example.org","voter2@example.org"]}'
```

Eligibility is **frozen** once the agenda opens. Attempts to edit afterward return `409`.

### 4) Admin opens the agenda

```bash
curl -X POST http://localhost:3000/agendas/$AGENDA_ID/open \
  -H "authorization: Bearer $ADMIN_TOKEN"
```

### 5) Voters cast ballots via the web UI

They sign in, pick an option, and submit. The UI runs the disjunctive ZKP locally and sends the ciphertext + proof to the API, which forwards to the chain.

### 6) Admin closes the agenda

```bash
curl -X POST http://localhost:3000/agendas/$AGENDA_ID/close \
  -H "authorization: Bearer $ADMIN_TOKEN"
```

### 7) Trustees submit decryption shares

Each trustee logs in and opens `/agendas/<id>/trustee` in the web UI. They paste their hex-encoded secret share — the browser runs partial decryption and submits one share per option. The share **never** leaves the browser; only the Chaum-Pedersen-signed partial is transmitted.

### 8) Admin publishes the tally

```bash
curl -X POST http://localhost:3000/results/publish \
  -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d "{\"agendaId\":\"$AGENDA_ID\"}"
# → 201 { agendaId, results: [{optionId, count}, …], publishedAt }
```

The final tally is fetchable at `GET /results/$AGENDA_ID` and shown on the AgendaResult view in the web UI.

---

## Web UI coverage

| Action                            | Web UI | API         |
|-----------------------------------|:------:|-------------|
| OTP login / logout                | ✅     | `/auth/*`   |
| List agendas                      | ✅     | `GET /agendas` |
| Cast ballot                       | ✅     | `POST /ballots` |
| View published result             | ✅     | `GET /results/:id` |
| Trustee submit decryption shares  | ✅     | `POST /decryption-shares` |
| Create agenda + generate trustee keys | ✅ | `POST /agendas` |
| Open / close agenda               | ✅     | `POST /agendas/:id/{open,close}` |
| Manage eligibility roster         | ✅     | `POST /agendas/:id/eligibility`, `GET /admin/agendas/:id/eligibility` |
| Publish tally                     | ✅     | `POST /results/publish` |
| Promote voter → admin/trustee     | ✅     | `POST /admin/voters/role` |

### Admin web UI

Visit `/admin` while signed in as a user with `role=admin`. Non-admins who
hit any `/admin/*` route are redirected to `/agendas`. The admin surface has
two tabs:

- **agendas** — list all agendas (including drafts) with status chips. Click
  an agenda to see detail: state-transition buttons, eligibility editor
  (only active while draft), trustee submission progress, and the publish
  button (enabled once every option has a quorum of shares).
- **users** — list every registered voter and change their role.

The **new agenda** form does threshold-key generation in the browser via
`Threshold.trustedDealerKeygen`. After generation the UI shows every
trustee's secret share exactly once — copy it into a secure out-of-band
channel to that trustee before clicking **create agenda**. The server never
receives the secret shares, only the public group key and per-trustee public
shares.

---

## Testing

### Automated

```bash
# full workspace
mise exec -- pnpm -r run test
mise exec -- pnpm -r run typecheck

# individual packages
mise exec -- pnpm --filter @ovote/crypto run test    # 31 unit tests
mise exec -- pnpm --filter @ovote/api   run test     # e2e: full ballot lifecycle + trustee flow
```

The e2e test ([apps/api/src/e2e.test.ts](../apps/api/src/e2e.test.ts)) walks the full flow in-memory: admin bootstrap → create/open agenda → eligibility → voter login → blind signature → ballot cast → close → per-option aggregate → trustee shares → publish → fetch. It's the best place to see the intended happy path in one file.

### Manual smoke test (local dev)

1. Start API + web as [above](#local-development).
2. Sign in as `admin@example.test` — grab OTP from terminal.
3. Run the curl sequence from [Running an election](#running-an-election-end-to-end), using the admin token.
4. Sign out, sign back in as a voter (email added in step 3), cast a ballot via the UI.
5. Sign back in as admin, close the agenda.
6. Promote a voter to `trustee` via SQLite, sign in as that trustee, submit shares.
7. Sign in as admin, publish the tally, verify the result page.

### Fabric integration smoke

```bash
cd deploy/compose
cp .env.example .env          # fill in OVOTE_FABRIC_* values
docker compose up --build     # brings up the Fabric test-network + API + web
```

See [deploy/fabric/README.md](../deploy/fabric/README.md) and [deploy/compose/README.md](../deploy/compose/README.md) for the full flow.

---

## Production deployment

Before exposing the API to the public internet:

- [ ] **`OVOTE_SECRET_KEY`** explicitly set (32 random bytes, base64url). Losing this key bricks every agenda's blind-signing key.
- [ ] **`OVOTE_CORS_ORIGINS`** pinned to the exact web UI origin(s). Default `*` is dev-only.
- [ ] **`OVOTE_TRUST_PROXY`** set to the CIDR of your ingress (e.g. `10.0.0.0/8`) or left at `false`. `true` is dangerous behind a proxy that doesn't strip client-supplied `X-Forwarded-For`.
- [ ] **`OVOTE_SMTP_URL`** configured. Without it OTPs go to logs.
- [ ] **`OVOTE_ADMIN_BOOTSTRAP_EMAIL`** either unset (after first boot) or pinned to a controlled inbox.
- [ ] **TLS termination** at the ingress. The API speaks plain HTTP internally.
- [ ] **SQLite path** on persistent storage (the DB holds OTPs, sessions, eligibility, encrypted signing keys).
- [ ] **Logs** scrubbed of OTPs — never ship a build that still uses `ConsoleMailer`. Set `OVOTE_SMTP_URL` and grep logs for `dev mailer` to be sure.
- [ ] **Fabric** — use a real network (`OVOTE_CHAIN_DRIVER=fabric`), not the in-memory driver.
- [ ] **Rate limits** — review the values in [src/routes/*.ts](../apps/api/src/routes) for your expected voter turnout.

---

## Key management

### Master secret key (`OVOTE_SECRET_KEY`)

- Used by [services/secret-key.ts](../apps/api/src/services/secret-key.ts) to wrap every per-agenda RSA blind-signing key with AES-256-GCM.
- Generate: `head -c 32 /dev/urandom | basenc --base64url -w0`.
- Rotation: no in-place rotation today. To rotate, decrypt every row in `blind_signer_keys` with the old key and re-encrypt under the new one; this is a short script against the DB — but coordinate with any agenda mid-run.

### Per-agenda RSA key

- Generated lazily on `POST /agendas` by [AgendaSigner.getOrCreate](../apps/api/src/services/signer.ts). PKCS8 bytes are AES-GCM-encrypted before insert; decrypted only in process memory when signing.
- There is **one** RSA key per agenda. If it's compromised, credentials for that agenda can be forged — rotate by closing the agenda and starting a new one.

### Trustee secret shares

- Generated at `Threshold.trustedDealerKeygen` time (see step 1 of [Running an election](#running-an-election-end-to-end)).
- Distributed out-of-band, one per trustee. Hex-encoded for clipboard safety.
- **Never** submitted to any server — only partial decryptions (derived, verifiable, non-reversible) leave the trustee's browser.
- Loss of a share below threshold doesn't reveal votes, but loss of quorum makes the election undecryptable. Keep backups under split control.

---

## Known limitations and security notes

See [SECURITY.md](../SECURITY.md) for the disclosure policy.

- **Scope.** ovote is for **consortium / organizational** elections. Not suitable for public government elections. See [ADR 0001](adr/0001-scope-and-compliance.md).
- **Coercion.** The system is **not** coercion-resistant. A voter can prove how they voted to a third party (receipt-freeness is partial, not full).
- **Device trust.** End-to-end verifiability assumes voter's device is honest. No defense against malware on the voter's computer.
- **Network anonymity.** The registrar sees the IP and email of every voter. Blind-signing breaks voter↔ballot linkability at the cryptographic level, but traffic analysis + timing is out of scope.
- **Trustee key generation.** v1 uses a trusted dealer. For stronger guarantees swap in DKG — the on-chain format is ready for it.
- **Single-choice ballots only.** The sum-proof in `ballot-verifier.ts` binds each ballot to encrypt exactly one `1` across all options. Supporting "pick up to k" or ranked ballots would need a different aggregate proof (e.g. sum ∈ {1..k}).
- **Tally verification on-chain is partial.** The chaincode enforces (a) threshold trustee shares are present for every option and (b) the published counts sum to the total number of ballots cast — both refuse trivially fabricated tallies. It does **not** re-run the Lagrange interpolation or the small discrete-log decoding on-chain, because that would require porting ristretto255 + Schnorr verification to Go. Auditors can re-run the full crypto off-chain with `@ovote/crypto` against the public bulletin board.
- **Single Fabric identity.** The API uses one certificate for every on-chain role; the chaincode `ovote.role` attribute is a comma-separated list (`admin,registrar,trustee`). Deployments that want stronger separation can issue one identity per role — the chaincode accepts both.
- **Single-instance API.** Sessions and OTPs are stored in SQLite on one node. Multi-replica deployments need a shared DB or a move to Redis.
- **Eligibility is frozen at open.** Adding a voter after the agenda opens returns `409`. This is by design — late additions break the "who could vote" auditor check.
- **OTP over email.** Email is the weakest link. For anything sensitive combine with SSO or an additional second factor at the proxy layer.
