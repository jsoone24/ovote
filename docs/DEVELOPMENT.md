# Development Environment

All runtimes for this project are **project-scoped**. Nothing is installed into your global shell PATH; nothing writes outside this repo or its tool-managed cache directories.

## What gets installed where

| Tool   | Version pin        | Location                                     |
|--------|--------------------|----------------------------------------------|
| mise   | any recent         | `/opt/homebrew/bin/mise` (one global switcher, like `pyenv`) |
| Node   | see `.mise.toml`   | `~/.local/share/mise/installs/node/<ver>`    |
| Go     | see `.mise.toml`   | `~/.local/share/mise/installs/go/<ver>`      |
| pnpm   | via corepack       | `./.cache/bin/` (project-local)              |
| Go caches | —               | `./.cache/go/` (project-local, not `$HOME/go`) |
| pnpm store | —              | `./.cache/pnpm/`                             |
| Docker | desktop install    | `/Applications/Docker.app`                   |

No shell profile (`~/.zshrc`, `~/.bashrc`, …) is modified.

## One-time setup

```sh
brew install mise            # if not installed
cd <this repo>
mise trust                   # review and trust the .mise.toml
mise run setup               # installs Node, Go, enables pnpm, installs deps
```

## Running commands

Two options, your choice:

### Option A — no shell activation (stricter isolation)

Every command goes through `mise`:

```sh
mise run doctor              # print resolved versions
mise run api:dev             # backend dev server
mise run web:dev             # frontend dev server
mise run chaincode:test      # go tests

mise exec -- node --version  # ad-hoc
mise exec -- go build ./...
```

### Option B — auto-activate when you `cd` in (nicer UX)

Add this line **yourself** to your `~/.zshrc`:

```sh
eval "$(mise activate zsh)"
```

Then `node`, `go`, `pnpm` are on PATH only while you are inside this repo. `cd` out and they disappear.

## Container runtime

Fabric test-network, Mongo, RabbitMQ/Redis, and per-service containers run under **Docker Desktop** (already installed on this machine). Project compose files will live under `deploy/compose/` once the Phase 2 upgrade begins. No containers are started by the setup task — you bring up only what you need.

## Uninstall / cleanup

```sh
mise uninstall node go       # remove project runtimes
rm -rf .cache                # clear project-local caches
brew uninstall mise          # if you also want to remove the switcher
```

Nothing else needs unwinding.
