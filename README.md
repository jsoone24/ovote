# o_vote

## Description

    Online vote system base on blockchain using hyperledger fabric

## Environment

-   Hyperledger fabric v1.4.x
-   Hyperledger fabric sdk
-   MySql v8.0.29
-   Express v4.16.1
-   AngularJS v1.8.3
-   Node.js v10.15.3
-   npm v6.4.1
-   Go v1.11.1

## Installation

### Chaincode

1. vendor all dependencies

    ```
    cd chaincode
    export GOPATH=`pwd`/cc:`pwd`/fabric
    go get -u github.com/jinzhu/inflection
    go get -u github.com/kardianos/govendor
    go install ovote/main
    cp -r cc work
    export GOPATH=`pwd`/work:`pwd`/fabric
    export PATH=`pwd`/work/bin:$PATH
    pushd work/src/ovote/main
    govendor init
    govendor add ovote
    govendor add ovote/chaincode
    govendor add github.com/jinzhu/inflection
    popd
    mkdir -p dist/src/ovote/ && cp -r work/src/ovote/main ./dist/src/ovote
    ```

1. build chaincode
    ```
    export GOPATH=`pwd`/dist:`pwd`/fabric
    go install ovote/main
    ```

### WebApplication

1. Admin
    ```
    cd admin
    bower install
    ```
2. Client
    ```
    cd admin
    bower install
    ```
3. NodeServer
    ```
    npm install
    ```

### BlockChainNetwork

1. configure config file and generate private keys and certification
    ```
    cd network
    mkdir config
    ./generate.sh
    ```
2. check organization's privatekey file name
    ```
    cd network/crypto-config/peerOrganizations
    find . | grep -E '/ca.*_sk' | sort
    ```
3. copy and paste file name on each ca.org\*.example.com(FABRIC_CA_SERVER_TLS_CERTFILE,FABRIC_CA_SERVER_TLS_KEYFILE ) in docker-compose.yml

## Run O_Vote

### Blockchain Network

```
cd network
./start.sh
```

### Web Application

1. register users and deploy chaincode on blockchain network
    ```
    export GOPATH=`pwd`/chaincode/dist
    node server/scirpts/registeruser.js
    node server/scripts/deploy.js
    node server/scripts/addOwners.js
    ```
2. run server
    ```
    nodemon
    ```

## Info

1. network/generate.sh
    - configure BlockChainNetwork and generate private key and certificate
    - files will be stored to network/crypto-config/peerOrganizations
2. network/configtx.yaml
    - config file generating channel artifacts
        1. create orderer genesis block
        2. create channel transaction config file channel.tx
        3. create anchor peer to each orgs
3. network/crypto-config.yaml
    - config file creating certificate and key pair
4. network/docker-compose.yml
    - start all required containers with settings
    - created containers
        1. orderer container
        2. ca(certification authority) container
        3. peer container
        4. cli container
5. network/connection.json, connection.yaml
    - describes a set of components(peers, orderers, CAs, channel, org info) to configure gateway that handles all network interactions
    - used mainly by application
6. network/start.sh
    - create docker containers by docker-compose.yml
    - create and join channel through docker cli(preconfigured easy use command and configurations for BlockChainNetwork) container
7. network/teardown.sh
    - remove all containers

## Troubleshooting

-   About gopath error (undefined path error) when running application/scripts/deploy.js
    -   try setting gopath to chaincode.
    -   ex) `` export GOPATH=`pwd`/chaincode/dist ``
-   About MACOS dial unix: /host/var/run/docker.sock error when running application/scripts/deploy.js
    -   try switching off "Use gRPC FUSE for file sharing" option in docker preferences
