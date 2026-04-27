# @ovote/api

Fastify 5 registrar that mediates between the voter UI, the consortium chaincode, and the off-chain identity / blind-signing state.

## Quick reference

| Route group | File | Purpose |
|---|---|---|
| `/auth/*` | `routes/auth.ts` | OTP request/verify/logout |
| `/agendas` | `routes/agendas.ts` | List, get, create (admin), open/close (admin), eligibility (admin) |
| `/credentials/blind-sign` | `routes/credentials.ts` | Voter-side credential issuance — idempotent |
| `/ballots` | `routes/ballots.ts` | Public submission (credential is the eligibility proof) |
| `/decryption-shares`, `/agendas/:id/aggregate` | `routes/trustees.ts` | Trustee bulletin board |
| `/results/*` | `routes/results.ts` | Admin-publish, public read |
| `/admin/*` | `routes/admin.ts` | User listing + role mgmt |

The full HTTP reference (payloads, rate limits, error codes) is in [docs/API.md](../../docs/API.md).

## Architecture

```
            FastifyInstance (server.ts)
            ├─ auth middleware (requireSession / requireRole)
            ├─ routes/* (one file per concern)
            ├─ services/
            │   ├─ chain.ts        ChainGateway interface + MemoryChain
            │   ├─ fabric-chain.ts FabricChain implementing the same interface
            │   ├─ otp.ts          OtpService + SessionService (peppered HMAC)
            │   ├─ voters.ts       VoterRegistry — sqlite-backed voter directory
            │   ├─ signer.ts       AgendaSigner — RSA-BSSA blind signing per agenda
            │   ├─ secret-key.ts   AES-256-GCM envelope codec (resolves OVOTE_SECRET_KEY)
            │   ├─ ballot-verifier.ts  re-runs every ZK proof before forwarding to chain
            │   └─ mailer.ts       ConsoleMailer (dev) | SmtpMailer (prod)
            ├─ db.ts               better-sqlite3 with additive migrations
            └─ config.ts           Zod-validated environment configuration
```

Two key invariants:

1. **Every ballot is verified twice** — once at the API in `ballot-verifier.ts`, then again on the chain in `chaincode/ovote/tally_verify.go`. The chain copy is authoritative; the API copy is a fast reject path that keeps malformed proofs out of the bulletin board.
2. **Sessions and OTPs are pepper-bound to `OVOTE_SECRET_KEY`** — losing the key invalidates all in-flight auth, but never a single ballot. Rotation procedure is documented in [docs/OPERATIONS.md](../../docs/OPERATIONS.md#secret-key-rotation).

## Local development

```bash
pnpm --filter @ovote/api dev          # tsx --watch on src/index.ts
pnpm --filter @ovote/api test         # vitest run
pnpm --filter @ovote/api typecheck    # tsc --noEmit
```

The API auto-creates `OVOTE_DB_PATH` if missing and writes a sibling `secret.key` (mode 0600) on first boot when `OVOTE_SECRET_KEY` is unset. **Never check that file in.**

`OVOTE_CHAIN_DRIVER=memory` (default) runs against an in-memory ChainGateway so you can develop without spinning up Fabric. Flip to `fabric` and follow [deploy/fabric/README.md](../../deploy/fabric/README.md) for the on-chain flow.

## Tests

The suite is a deliberately small set of high-leverage tests:

- `e2e.test.ts` — full agenda lifecycle through MemoryChain (admin → trustees keygen → eligibility → voter login → blind sign → ballot cast → close → trustees decrypt → admin publish)
- `regressions.test.ts` — focused regression tests for issues caught in past reviews (logout revocation, malformed-ballot 400, last-admin demote guard)
- `services/otp.test.ts` — sweeper hygiene

Adding a new public route? Add a positive test plus at least one negative test (auth failure, validation failure, or wrong-state failure) in the same commit.
