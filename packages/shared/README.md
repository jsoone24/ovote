# @ovote/shared

Wire-format contract shared by `apps/api`, `apps/web`, and any third-party verifier that wants to re-run the protocol against a published bulletin board. Pure types and runtime validators — no I/O, no platform deps.

## What's in here

| File | What |
|---|---|
| `domain.ts` | TypeScript types for `Agenda`, `Ballot`, `TallyProof`, `TrusteeDecryptionShare`, and friends. The single source of truth for the wire shape. |
| `schemas.ts` | Strict [Zod](https://zod.dev/) schemas mirroring every domain type, with compile-time `Equal<>`/`Expect<>` checks so the inferred and declared types cannot drift. |
| `encoding.ts` | base64url round-trip and RFC 8785-flavored canonical JSON (sorted keys, no whitespace, rejects `undefined`/`NaN`/`Infinity`/`bigint`). |

## Why a separate package

Three reasons:

1. **No tight coupling between the front-end and back-end TypeScript.** Both depend on the same package; if the schema changes, both fail to typecheck.
2. **The Go chaincode must produce byte-identical canonical JSON for Fiat-Shamir transcripts.** Centralising the encoding rules in one place makes them easier to mirror.
3. **Auditors can install just this package** to validate any payload they pulled off the public bulletin board.

## Public exports

- Types — every entity in `domain.ts`.
- Validators — `parseAgenda`, `parseBallot`, `parseTallyProof`, `parseTrusteeDecryptionShare`. Each throws a `ZodError` on a malformed payload; the API's global error handler maps that to HTTP 400.
- Encoding — `toB64Url`, `fromB64Url`, `canonicalJSON`.

## Tests

```bash
pnpm --filter @ovote/shared test
```
