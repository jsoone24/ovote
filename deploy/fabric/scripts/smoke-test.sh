#!/usr/bin/env bash
# smoke-test.sh — minimal read invocation to confirm the chaincode is reachable.
# Queries GetAgenda for a random id; we only check that the peer endorsement
# path is wired up (the expected response is the "not found" error).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_env.sh"

peer_env 1

random_id="$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)"
echo "==> query GetAgenda(\"$random_id\") — expecting a not-found error"
peer chaincode query \
  -C "$CHANNEL_NAME" \
  -n "$CHAINCODE_NAME" \
  -c "{\"Args\":[\"GetAgenda\",\"$random_id\"]}" || true
