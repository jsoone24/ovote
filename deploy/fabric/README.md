# ovote Fabric test-network

A minimal Hyperledger Fabric 2.5 LTS test-network for local development and
integration testing of the `chaincode/ovote` contract.

## Topology

- 1 orderer (Raft, single node) — `orderer.ovote.local`
- 2 peer organizations, each with 1 peer:
  - `Org1MSP` / `peer0.org1.ovote.local` (registrars + voters)
  - `Org2MSP` / `peer0.org2.ovote.local` (auditors + trustees)
- 1 channel: `ovote-channel`

The topology is intentionally small — enough to exercise endorsement across
two orgs while fitting on a developer laptop. Production deployments should
add more peers, a Raft cluster of 3–5 orderers, HSM-backed MSPs, and TLS
termination handled by your existing ingress.

## Prerequisites

- Docker 24+ with compose plugin
- Fabric binaries (`cryptogen`, `configtxgen`, `peer`) 2.5.x on `PATH` —
  run `scripts/bootstrap-binaries.sh` to install them under
  `deploy/fabric/bin/` without touching anything else on your system.

Everything runs inside a dedicated docker network `ovote-fabric`; nothing
is installed globally.

## Quick start

```bash
cd deploy/fabric
./scripts/bootstrap-binaries.sh     # one-time: fetch cryptogen/configtxgen/peer
./scripts/network-up.sh             # generate crypto, start containers, create channel
./scripts/chaincode-deploy.sh       # package + install + approve + commit chaincode
./scripts/network-down.sh           # tear everything down and wipe state
```

Generated material (`crypto-config/`, `channel-artifacts/`, `bin/`) is
git-ignored. All data lives under `deploy/fabric/` — no system-wide state.

## Environment for the API

After `network-up.sh` and `chaincode-deploy.sh` complete, the API can talk
to Fabric with:

```
OVOTE_CHAIN_DRIVER=fabric
OVOTE_FABRIC_CHANNEL=ovote-channel
OVOTE_FABRIC_CHAINCODE=ovote
OVOTE_FABRIC_MSP_ID=Org1MSP
OVOTE_FABRIC_PEER_ENDPOINT=peer0.org1.ovote.local:7051
OVOTE_FABRIC_TLS_CERT=deploy/fabric/crypto-config/peerOrganizations/org1.ovote.local/peers/peer0.org1.ovote.local/tls/ca.crt
OVOTE_FABRIC_IDENTITY=deploy/fabric/crypto-config/peerOrganizations/org1.ovote.local/users/Admin@org1.ovote.local
```

The Fabric gateway driver is a v2 task (see `docs/adr/0005`); v1 uses
`OVOTE_CHAIN_DRIVER=memory`.
