# References and Others

## 블록체인 참고자료
* [하이퍼레저패브릭바탕으로 앱 제작](https://hyperledger-fabric.readthedocs.io/en/release-2.5/write_first_app.html)
* [채널생성 참고자료](https://hyperledger-fabric.readthedocs.io/en/release-2.5/create_channel/create_channel_overview.html)
* [채널에 기관 가입](https://hyperledger-fabric.readthedocs.io/en/release-2.5/channel_update_tutorial.html)
* [체인코드 작성 참고자료 1](https://hyperledger-fabric.readthedocs.io/en/release-2.5/chaincode4ade.html#choosing-a-location-for-the-code)
* [체인코드 작성 참고자료2](https://github.com/hyperledger/fabric-contract-api-go/blob/main/tutorials/getting-started.md#declaring-a-contract)
* [체인코드 작성 참고자료3](https://hyperledger-fabric.readthedocs.io/en/release-2.5/deploy_chaincode.html)

## Setup Environment Variables to Use Peer Commend to Network

**피어 명령어로 블록체인 네트워크에 명령을 전달하기 위한 패스 설정**
```Shell
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/
```
**기관1을 통해 명령 전달 위해 환경 설정**
```Shell
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051
```

**예시 명령**
```Shell
peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" -C mychannel -n ovote --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" -c '{"function":"AddVote","Args":["a","b","c","d"]}'
```

**Docker Log**
```Shell
./monitordocker.sh fabric_test
```
