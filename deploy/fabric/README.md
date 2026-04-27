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
OVOTE_FABRIC_PEER_HOSTNAME_OVERRIDE=peer0.org1.ovote.local
OVOTE_FABRIC_TLS_ROOT_CERT=deploy/fabric/crypto-config/peerOrganizations/org1.ovote.local/peers/peer0.org1.ovote.local/tls/ca.crt
OVOTE_FABRIC_SIGNCERT=deploy/fabric/crypto-config/peerOrganizations/org1.ovote.local/users/Admin@org1.ovote.local/msp/signcerts/Admin@org1.ovote.local-cert.pem
OVOTE_FABRIC_KEYSTORE_DIR=deploy/fabric/crypto-config/peerOrganizations/org1.ovote.local/users/Admin@org1.ovote.local/msp/keystore
```

## Role attribute on the API identity

Chaincode reads the `ovote.role` attribute from the caller's certificate to
gate each method. Because the API is a trusted relay that performs every
role on behalf of end users (admin → create agenda, registrar → forward
ballots, trustee → submit shares), the attribute is a comma-separated list
on a single cert, e.g. `ovote.role=admin,registrar,trustee`.

`cryptogen` (used by this dev network) does not issue certs with custom
attributes. Production deployments must use fabric-ca to register the API
identity with the desired roles, for example:

```
fabric-ca-client register \
  --id.name api-gateway \
  --id.attrs "ovote.role=admin,registrar,trustee:ecert"
fabric-ca-client enroll -u https://api-gateway:PASS@ca.org1.ovote.local:7054
```

If you want hard separation between roles, issue one identity per role and
run three gateway clients. The chaincode will accept both models — it only
checks that the required role appears in `ovote.role`.

The Fabric gateway driver is a v2 task (see `docs/adr/0005`); v1 uses
`OVOTE_CHAIN_DRIVER=memory`.
