#!/usr/bin/env bash
# network-down.sh — tear down the ovote Fabric test-network and wipe state.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_env.sh"

cd "$ROOT"

docker compose -f "$COMPOSE_FILE" down -v --remove-orphans || true

rm -rf crypto-config channel-artifacts
# Remove packaged chaincode leftovers from the host.
rm -f "$ROOT/${CHAINCODE_NAME}.tar.gz"

# Remove per-peer chaincode dev containers that Fabric 2.5 spawns for Go
# chaincode. They are named dev-peer0.orgX.ovote.local-<label>-<hash>.
for container in $(docker ps -a --filter "name=dev-peer0" --format '{{.Names}}'); do
  docker rm -f "$container" >/dev/null 2>&1 || true
done

for image in $(docker images --filter "reference=dev-peer0*" -q); do
  docker rmi -f "$image" >/dev/null 2>&1 || true
done

echo "ovote-fabric stopped and state wiped."
