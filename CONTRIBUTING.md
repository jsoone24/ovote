# Contributing to ovote

Thanks for taking the time to look at the code. This document is the short version of how the project is structured and what we ask of contributors. The longer architecture-and-operations write-up lives in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/OPERATIONS.md](docs/OPERATIONS.md); the day-to-day developer setup lives in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

---

## Ground rules

1. **Scope.** ovote targets consortium and organizational voting only. PRs that aim it at public government elections will be declined. See [ADR 0001](docs/adr/0001-scope-and-compliance.md).
2. **No PII on-chain.** Anything that lands in the chaincode must be encrypted ciphertexts, zero-knowledge proofs, or non-identifying metadata. Voter emails and identity-side records stay in the API's SQLite layer where the GDPR/PIPA right-to-erasure can reach them.
3. **Crypto invariants.** Any change that affects byte-level transcripts (hash domains, point/scalar encodings, proof field ordering) must update both the TypeScript reference (`packages/crypto`) and the Go port (`chaincode/ovote/crypto`), then regenerate the parity fixture and check that CI's drift guard passes. See [docs/OPERATIONS.md § Regenerating cross-language crypto parity fixtures](docs/OPERATIONS.md#regenerating-cross-language-crypto-parity-fixtures).
4. **No secrets in commits.** `.env`, keystores, and Fabric crypto material are git-ignored; double-check `git status` before pushing.

---

## Local setup

The repo uses [`mise`](https://mise.jdx.dev/) so every toolchain (Node, Go, pnpm) is project-scoped and pinned. After cloning:

```bash
mise install
pnpm install --frozen-lockfile
```

That's the whole bootstrap. Everything else is pnpm and go.

---

## The build, test, lint loop

| Concern | Command |
|---|---|
| Type check (TS) | `pnpm -r --if-present typecheck` |
| Build (TS) | `pnpm -r --if-present build` |
| Test (TS) | `pnpm -r --if-present test` |
| Test (Go chaincode) | `( cd chaincode/ovote && go test ./... )` |
| Vet (Go chaincode) | `( cd chaincode/ovote && go vet ./... )` |
| Run dev API | `pnpm --filter @ovote/api dev` |
| Run dev Web | `pnpm --filter @ovote/web dev` |
| Full-stack docker | `( cd deploy/compose && docker compose up --build )` |

CI (`.github/workflows/ci.yml`) runs all of the above on every PR plus a Docker image build. PRs that don't go green in CI do not merge.

---

## Coding conventions

- **TypeScript.** Strict mode is on. No `any` unless you justify it in a comment. `tsconfig.base.json` is the source of truth; package-level configs only narrow `include`/`outDir`.
- **Vue.** Single-file components, `<script setup lang="ts">`. PascalCase filenames for components, kebab-case for everything else.
- **Go.** Standard `gofmt`. Doc comments on every exported symbol.
- **Tests.** Vitest for TS, the standard `testing` package for Go. New routes, services, and crypto primitives ship with tests in the same commit. See [`apps/api/src/regressions.test.ts`](apps/api/src/regressions.test.ts) for the regression-test convention.
- **Comments.** Comment the *why*, not the *what*. The crypto modules in particular need to explain the security properties of each primitive — readers should not have to re-derive proofs to understand the code.

---

## Pull requests

- Branch from `main`. Use a short, lowercase, hyphenated branch name describing the work (`fix-ballot-replay`, `add-trustee-progress-bar`).
- Keep commits focused. Squash merges are fine; the resulting commit message is the one that lands on `main`, so make it descriptive.
- Include a summary of what changed and *why* in the PR description. Link the relevant ADR if you're touching cryptography or threat-model surface.
- A reviewer will want to see green CI, updated docs (if behavior changed), and tests for new behavior.

---

## Making changes that touch cryptography

This is the highest-risk area in the codebase. The rules:

1. Read [docs/adr/0003-cryptographic-scheme.md](docs/adr/0003-cryptographic-scheme.md) and [docs/adr/0005-on-chain-proof-verification.md](docs/adr/0005-on-chain-proof-verification.md) first.
2. Add the test before the change. Crypto bugs are silent — without a failing test, a green build means nothing.
3. If you change a Fiat-Shamir transcript, hash domain, or any byte-level encoding:
   - Update both the TS reference (`packages/crypto`) and the Go port (`chaincode/ovote/crypto`).
   - Re-run the parity dumper:
     ```bash
     pnpm --filter @ovote/crypto exec tsx scripts/dump-vectors.ts \
       chaincode/ovote/crypto/testdata/vectors.json
     ```
   - Commit the regenerated fixture file alongside the code change. CI's `git diff --exit-code` step will reject the PR otherwise.
4. Note in the PR description that you have done this, and why the change is safe.

---

## Reporting security issues

Please do **not** open a public issue for security bugs. See [SECURITY.md](SECURITY.md) for the disclosure channel.
