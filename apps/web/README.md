# @ovote/web

Vue 3 voter, trustee, and admin client. Vite-built, served by nginx in production (`deploy/compose/web/`).

## Surface

```
src/
  main.ts            App bootstrap
  App.vue            Top nav + sign-out (calls POST /auth/logout)
  router.ts          vue-router routes + admin role guard
  api.ts             Single-file backend client (Bearer-token aware)
  services/
    session.ts       sessionStorage-backed reactive session state
    voting.ts        Browser-side ballot construction + Benaloh challenge
    trustee.ts       Browser-side partial decryption (secret share never leaves)
  views/
    Login.vue        OTP request + verify
    AgendaList.vue   Public agenda list, voter / trustee dispatch
    AgendaVote.vue   Cast a ballot
    AgendaResult.vue Published tally
    AgendaTrustee.vue Trustee partial decryption
    admin/           Admin pages (guarded by router beforeEach)
```

## Why sessionStorage instead of localStorage

The session token is held in `sessionStorage` so it dies when the tab closes. Voter sessions are short-lived by design; persisting across browser restarts would leave a token on disk that survives "I'm done voting" intent.

## Why trustees decrypt in the browser

Partial decryption uses the trustee's *private* key share. Sending it to the registrar would break the threshold trust model — the API would have de-facto custody of every share. Instead `services/trustee.ts` runs the partial-decrypt routine entirely in the browser; only the resulting share point + Schnorr proof is uploaded.

The same logic applies to **admin agenda creation**: the threshold key is generated in the browser via `Threshold.trustedDealerKeygen`, and trustee secret shares are displayed to the operator exactly once (as hex). The shares never reach the server.

## Local development

```bash
pnpm --filter @ovote/web dev          # vite dev server on :5173
pnpm --filter @ovote/web build        # production bundle in dist/
pnpm --filter @ovote/web test         # vitest run (happy-dom)
```

The dev server proxies `/api/*` to `http://127.0.0.1:3000` — start the API in another terminal with `pnpm --filter @ovote/api dev`.

## Tests

Coverage is intentionally thin and high-value:

- `services/session.test.ts` — sessionStorage persistence + hydration
- `api.test.ts` — bearer-header attachment + POST /auth/logout

Both test areas regressed in past reviews; the smoke tests guard against the same drift recurring.
