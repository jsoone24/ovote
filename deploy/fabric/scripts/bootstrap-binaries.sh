#!/usr/bin/env bash
# Fetch Fabric 2.5 LTS binaries (cryptogen, configtxgen, peer, osnadmin) and
# install them under deploy/fabric/bin/. Nothing is installed system-wide.

set -euo pipefail

FABRIC_VERSION="${FABRIC_VERSION:-2.5.9}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$ROOT/bin"
CACHE_DIR="$ROOT/.fabric-cache"

mkdir -p "$BIN_DIR" "$CACHE_DIR"

uname_s="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$uname_s" in
  darwin) os="darwin" ;;
  linux)  os="linux" ;;
  *)      echo "unsupported OS: $uname_s" >&2; exit 1 ;;
esac

uname_m="$(uname -m)"
case "$uname_m" in
  x86_64|amd64) arch="amd64" ;;
  arm64|aarch64) arch="arm64" ;;
  *) echo "unsupported arch: $uname_m" >&2; exit 1 ;;
esac

tarball="hyperledger-fabric-${os}-${arch}-${FABRIC_VERSION}.tar.gz"
url="https://github.com/hyperledger/fabric/releases/download/v${FABRIC_VERSION}/${tarball}"

if [ ! -f "$CACHE_DIR/$tarball" ]; then
  echo "downloading $url"
  curl -fsSL -o "$CACHE_DIR/$tarball" "$url"
fi

tar -xzf "$CACHE_DIR/$tarball" -C "$CACHE_DIR"

# The archive extracts a `bin/` directory; copy only the binaries we need.
for tool in cryptogen configtxgen peer osnadmin discover; do
  if [ -f "$CACHE_DIR/bin/$tool" ]; then
    install -m 0755 "$CACHE_DIR/bin/$tool" "$BIN_DIR/$tool"
    echo "installed $BIN_DIR/$tool"
  fi
done

mkdir -p "$ROOT/config"
if [ -d "$CACHE_DIR/config" ]; then
  cp -R "$CACHE_DIR/config/." "$ROOT/config/"
fi

echo
echo "fabric ${FABRIC_VERSION} binaries ready at $BIN_DIR"
echo "add them to PATH with:  export PATH=\"$BIN_DIR:\$PATH\""
