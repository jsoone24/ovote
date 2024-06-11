const grpc = require("@grpc/grpc-js");
const {connect, signers} = require("@hyperledger/fabric-gateway");
const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
const {TextDecoder} = require("util");
const utf8Decoder = new TextDecoder();
const dotenv = require("dotenv");
dotenv.config();

const channelName = process.env.BC_CHANNEL_NAME;
const chaincodeName = process.env.BC_CHAINCODE_NAME;
const mspId = process.env.BC_MSPID;
const cryptoPath = path.resolve(__dirname, process.env.BC_Crypto_PATH,);
const keyDirectoryPath = path.resolve(cryptoPath, process.env.BC_KEYDIR_PATH);
const certDirectoryPath = path.resolve(cryptoPath, process.env.BC_CERTDIR_PATH);
const tlsCertPath = path.resolve(cryptoPath, process.env.BC_TLSCERT_PATH);
const peerEndpoint = process.env.BC_PEER_ENDPOINT;
const peerHostAlias = process.env.BC_PEER_HOST_ALIAS;

exports.submitToBlockchain = async (recordJson) => {
    const {contract, gateway, client} = await connectToBlockchain();
    try {
        await contract.submitTransaction("CreateRecord", recordJson);
        console.log("*** Transaction committed successfully");
    } catch (error) {
        console.error("Failed to create record", error);
    } finally {
        gateway.close();
        client.close();
    }
};

exports.readFromBlockchain = async (agendaId) => {
    const {contract, gateway, client} = await connectToBlockchain();
    try {
        // Get record from blockchain network and parse into JSON
        const resultBytes = await contract.evaluateTransaction("GetRecord");
        const resultString = utf8Decoder.decode(resultBytes);

        if (!resultString) {
            console.error("No data returned from blockchain");
            return [];
        }

        const blockchainRecords = JSON.parse(resultString);

        // filter blockChainRecords by agendaId
        return blockchainRecords.filter((record) => record.agendaId === agendaId);
    } catch (error) {
        console.error("Blockchain query failed", error);
    } finally {
        gateway.close();
        client.close();
    }
};

exports.readAllFromBlockchain = async () => {
    const {contract, gateway, client} = await connectToBlockchain();
    try {
        const resultBytes = await contract.evaluateTransaction("GetAllRecords");
        const resultString = utf8Decoder.decode(resultBytes);

        if (!resultString) {
            console.error("No data returned from blockchain");
            return [];
        }

        return JSON.parse(resultString);
    } catch (error) {
        console.error("Blockchain query failed", error);
    } finally {
        gateway.close();
        client.close();
    }
};

async function connectToBlockchain() {
    const client = await newGrpcConnection();
    const gateway = connect({
        client, identity: await newIdentity(), signer: await newSigner(), evaluateOptions: () => {
            return {deadline: Date.now() + 5000};
        }, endorseOptions: () => {
            return {deadline: Date.now() + 15000};
        }, submitOptions: () => {
            return {deadline: Date.now() + 5000};
        }, commitStatusOptions: () => {
            return {deadline: Date.now() + 60000};
        },
    });

    const network = gateway.getNetwork(channelName);
    const contract = network.getContract(chaincodeName);

    return {contract, gateway, client};
}

async function newGrpcConnection() {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        "grpc.ssl_target_name_override": peerHostAlias,
    });
}

async function newIdentity() {
    const certPath = await getFirstDirFileName(certDirectoryPath);
    const credentials = await fs.readFile(certPath);
    return {mspId, credentials};
}

async function getFirstDirFileName(dirPath) {
    const files = await fs.readdir(dirPath);
    return path.join(dirPath, files[0]);
}

async function newSigner() {
    const keyPath = await getFirstDirFileName(keyDirectoryPath);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}