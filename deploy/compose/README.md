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

## Fabric mode

When `OVOTE_CHAIN_DRIVER=fabric` is set, the API needs:

- the Fabric gateway environment variables (`OVOTE_FABRIC_CHANNEL`,
  `OVOTE_FABRIC_CHAINCODE`, `OVOTE_FABRIC_MSP_ID`,
  `OVOTE_FABRIC_PEER_ENDPOINT`, `OVOTE_FABRIC_PEER_HOSTNAME_OVERRIDE`,
  `OVOTE_FABRIC_TLS_ROOT_CERT`, `OVOTE_FABRIC_SIGNCERT`,
  `OVOTE_FABRIC_KEYSTORE_DIR`) — all passed through from the host `.env`
- the cryptogen/fabric-ca output bind-mounted inside the container at
  `/fabric` (set `OVOTE_FABRIC_CRYPTO_HOST_DIR` to the host directory that
  contains the `peerOrganizations/...` tree)

Apply the fabric overlay file on top of the main compose stack:

```bash
export OVOTE_CHAIN_DRIVER=fabric
export OVOTE_FABRIC_CRYPTO_HOST_DIR=$(pwd)/../fabric/crypto-config
docker compose \
  -f docker-compose.yaml \
  -f docker-compose.fabric.yaml \
  up --build
```

See `deploy/fabric/README.md` for notes on the `ovote.role` certificate
attribute the API identity needs.
