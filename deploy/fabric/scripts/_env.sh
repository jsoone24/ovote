#!/usr/bin/env bash
# Shared environment sourced by the other scripts. Pins PATH to the local
# fabric bin/ dir (populated by bootstrap-binaries.sh) and FABRIC_CFG_PATH
# to the local config/ dir (which holds core.yaml and orderer.yaml).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$ROOT/bin:$PATH"
export FABRIC_CFG_PATH="$ROOT/config"

COMPOSE_FILE="$ROOT/compose/docker-compose.yaml"
CHANNEL_NAME="${CHANNEL_NAME:-ovote-channel}"
CHAINCODE_NAME="${CHAINCODE_NAME:-ovote}"
CHAINCODE_VERSION="${CHAINCODE_VERSION:-1.0}"
CHAINCODE_SEQUENCE="${CHAINCODE_SEQUENCE:-1}"
CHAINCODE_LABEL="${CHAINCODE_LABEL:-${CHAINCODE_NAME}_${CHAINCODE_VERSION}}"

ORDERER_CA="$ROOT/crypto-config/ordererOrganizations/ovote.local/orderers/orderer.ovote.local/tls/ca.crt"
ORDERER_ADMIN_TLS_CERT="$ROOT/crypto-config/ordererOrganizations/ovote.local/orderers/orderer.ovote.local/tls/server.crt"
ORDERER_ADMIN_TLS_KEY="$ROOT/crypto-config/ordererOrganizations/ovote.local/orderers/orderer.ovote.local/tls/server.key"

peer_env() {
  # Usage: peer_env <org-number>
  local org=$1
  case "$org" in
    1)
      export CORE_PEER_LOCALMSPID=Org1MSP
      export CORE_PEER_ADDRESS=localhost:7051
      export CORE_PEER_TLS_ROOTCERT_FILE="$ROOT/crypto-config/peerOrganizations/org1.ovote.local/peers/peer0.org1.ovote.local/tls/ca.crt"
      export CORE_PEER_MSPCONFIGPATH="$ROOT/crypto-config/peerOrganizations/org1.ovote.local/users/Admin@org1.ovote.local/msp"
      ;;
    2)
      export CORE_PEER_LOCALMSPID=Org2MSP
      export CORE_PEER_ADDRESS=localhost:9051
      export CORE_PEER_TLS_ROOTCERT_FILE="$ROOT/crypto-config/peerOrganizations/org2.ovote.local/peers/peer0.org2.ovote.local/tls/ca.crt"
      export CORE_PEER_MSPCONFIGPATH="$ROOT/crypto-config/peerOrganizations/org2.ovote.local/users/Admin@org2.ovote.local/msp"
      ;;
    *)
      echo "peer_env: unknown org $org" >&2
      return 1
      ;;
  esac
  export CORE_PEER_TLS_ENABLED=true
}
