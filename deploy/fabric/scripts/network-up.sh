#!/usr/bin/env bash
# network-up.sh — bring up the ovote Fabric test-network.
# 1. cryptogen generates MSP + TLS material under crypto-config/
# 2. configtxgen produces the channel genesis block under channel-artifacts/
# 3. docker compose starts orderer + 2 peers
# 4. osnadmin joins the orderer to the channel
# 5. both peers join the channel

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_env.sh"

cd "$ROOT"

if [ ! -x "$ROOT/bin/cryptogen" ]; then
  echo "fabric binaries missing — run scripts/bootstrap-binaries.sh first" >&2
  exit 1
fi

echo "==> generating crypto material"
rm -rf crypto-config channel-artifacts
cryptogen generate --config=crypto-config.yaml --output=crypto-config

echo "==> generating channel genesis block"
mkdir -p channel-artifacts
configtxgen \
  -profile OvoteChannel \
  -channelID "$CHANNEL_NAME" \
  -outputBlock "channel-artifacts/${CHANNEL_NAME}.block"

echo "==> starting containers"
docker compose -f "$COMPOSE_FILE" up -d

echo "==> waiting for orderer admin endpoint"
for i in $(seq 1 30); do
  if curl -sk --cert "$ORDERER_ADMIN_TLS_CERT" --key "$ORDERER_ADMIN_TLS_KEY" \
      --cacert "$ORDERER_CA" https://localhost:7053/participation/v1/channels >/dev/null; then
    break
  fi
  sleep 1
done

echo "==> joining orderer to channel ${CHANNEL_NAME}"
osnadmin channel join \
  --channelID "$CHANNEL_NAME" \
  --config-block "channel-artifacts/${CHANNEL_NAME}.block" \
  -o localhost:7053 \
  --ca-file "$ORDERER_CA" \
  --client-cert "$ORDERER_ADMIN_TLS_CERT" \
  --client-key "$ORDERER_ADMIN_TLS_KEY"

echo "==> peer0.org1 joining channel"
peer_env 1
peer channel join -b "channel-artifacts/${CHANNEL_NAME}.block"

echo "==> peer0.org2 joining channel"
peer_env 2
peer channel join -b "channel-artifacts/${CHANNEL_NAME}.block"

echo
echo "ovote-fabric is up."
echo "  channel: ${CHANNEL_NAME}"
echo "  orderer: localhost:7050 (admin 7053)"
echo "  peer0.org1: localhost:7051"
echo "  peer0.org2: localhost:9051"
echo
echo "next: ./scripts/chaincode-deploy.sh"
