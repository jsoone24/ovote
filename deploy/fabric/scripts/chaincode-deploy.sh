#!/usr/bin/env bash
# chaincode-deploy.sh — package, install, approve, and commit the ovote
# chaincode onto both peer orgs on the channel.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_env.sh"

REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
CHAINCODE_PATH="$REPO_ROOT/chaincode/ovote"
PACKAGE="$ROOT/${CHAINCODE_NAME}.tar.gz"

cd "$ROOT"

echo "==> packaging chaincode (${CHAINCODE_LABEL})"
peer lifecycle chaincode package "$PACKAGE" \
  --path "$CHAINCODE_PATH" \
  --lang golang \
  --label "$CHAINCODE_LABEL"

install_on() {
  local org=$1
  peer_env "$org"
  echo "==> installing chaincode on org${org}"
  peer lifecycle chaincode install "$PACKAGE"
}

install_on 1
install_on 2

peer_env 1
PACKAGE_ID="$(peer lifecycle chaincode queryinstalled --output json \
  | grep -o "\"package_id\": *\"${CHAINCODE_LABEL}:[a-f0-9]*\"" \
  | head -1 | awk -F'"' '{print $4}')"
if [ -z "$PACKAGE_ID" ]; then
  echo "could not determine package id" >&2
  exit 1
fi
echo "package id: $PACKAGE_ID"

approve_on() {
  local org=$1
  peer_env "$org"
  echo "==> approving chaincode for org${org}"
  peer lifecycle chaincode approveformyorg \
    -o localhost:7050 \
    --ordererTLSHostnameOverride orderer.ovote.local \
    --tls --cafile "$ORDERER_CA" \
    --channelID "$CHANNEL_NAME" \
    --name "$CHAINCODE_NAME" \
    --version "$CHAINCODE_VERSION" \
    --package-id "$PACKAGE_ID" \
    --sequence "$CHAINCODE_SEQUENCE"
}

approve_on 1
approve_on 2

peer_env 1
echo "==> checking commit readiness"
peer lifecycle chaincode checkcommitreadiness \
  --channelID "$CHANNEL_NAME" \
  --name "$CHAINCODE_NAME" \
  --version "$CHAINCODE_VERSION" \
  --sequence "$CHAINCODE_SEQUENCE" \
  --output json

echo "==> committing chaincode definition"
peer lifecycle chaincode commit \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.ovote.local \
  --tls --cafile "$ORDERER_CA" \
  --channelID "$CHANNEL_NAME" \
  --name "$CHAINCODE_NAME" \
  --version "$CHAINCODE_VERSION" \
  --sequence "$CHAINCODE_SEQUENCE" \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles "$ROOT/crypto-config/peerOrganizations/org1.ovote.local/peers/peer0.org1.ovote.local/tls/ca.crt" \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles "$ROOT/crypto-config/peerOrganizations/org2.ovote.local/peers/peer0.org2.ovote.local/tls/ca.crt"

echo
echo "chaincode ${CHAINCODE_NAME}@${CHAINCODE_VERSION} (seq ${CHAINCODE_SEQUENCE}) committed on ${CHANNEL_NAME}."
