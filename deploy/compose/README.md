# ovote compose stack

Full-stack local development environment: API + Web, with an optional link
to the Fabric test-network under `deploy/fabric/`.

## Stack

- `api` — Node 24 / Fastify 5, listens on `:3000`
- `web` — Vite build served by nginx on `:5173`
- shared docker network `ovote`

The stack defaults to `OVOTE_CHAIN_DRIVER=memory` — no Fabric is required
to boot it. Set `OVOTE_CHAIN_DRIVER=fabric` and bring up
`deploy/fabric` first if you want to exercise the on-chain bulletin board.

## Quick start

```bash
cd deploy/compose
cp .env.example .env        # edit as needed; at minimum set ADMIN_BOOTSTRAP_EMAIL
docker compose up --build
```

- Web UI: http://localhost:5173
- API:    http://localhost:3000

Logs show the OTP code whenever the web UI requests one (ConsoleMailer is
wired by default — swap it for an SMTP transport in production).

## Tear down

```bash
docker compose down -v
```

This removes the sqlite volume so the next boot starts fresh.
