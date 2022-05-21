/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
"use strict";

let config = require("config");
let CONFIG = config["asset"];
let helper = require("../helper.js");
let utils = require("fabric-client/lib/utils.js");
let logger = utils.getLogger("blockchainService");

//for block api
const ADMIN_USER = CONFIG["adminUser"];

let BlockchainService = function () {
    let vm = this;

    /**
     * 체인코드 설치
     * param {string} org - 대상 조직 이름
     * param {string} chaincode_id - 인스턴스별 체인코드 ID
     * param {string} chaincode_path - 체인코드 소스코드 경로
     * param {string} version - 버전
     * param {string} language - 체인코드 언어
     * param {boolean} get_admin - admin 여부
     */

    vm.install = function (org, chaincode_id, chaincode_path, version, language, get_admin) {
        logger.info(
            "install called. path:" + chaincode_path + " id: " + chaincode_id + " Ver: " + version
        );
        let client;
        let targets;

        return new Promise(function (resolve, reject) {
            helper
                .initObject(ADMIN_USER, org, true)
                .then((clientObj) => {
                    client = clientObj.client;
                    targets = clientObj.targets;
                    // 1. PeerAdmin 사용자 가져오기. getAdmin 참조
                    let username = "peer" + org + "Admin";
                    return client.getUserContext(username);
                })
                .then(
                    (submitter) => {
                        if (submitter) {
                            // 2. chaincode 소스코드의 경로와 ID를 지정해 설치
                            const request = {
                                targets: targets,
                                chaincodePath: chaincode_path,
                                chaincodeId: chaincode_id,
                                chaincodeType: language,
                                chaincodeVersion: version,
                            };
                            // 3. 보증인에게 설치 요청
                            return client.installChaincode(request);
                        } else {
                            let emsg = "install ERROR : ***err : Admin need enroll at first.";
                            logger.error(emsg);
                            throw new Error(emsg);
                        }
                    },
                    (err) => {
                        logger.error("Failed to enroll admin. " + err);
                        throw new Error("Failed to enroll admin. " + err);
                    }
                )
                .then(
                    (results) => {
                        logger.info("Success installChaincode");
                        let proposalResponses = results[0];
                        var errMsg = [];

                        // 4. 결과 검증
                        if (validateProposal(proposalResponses, targets.length, errMsg)) {
                            logger.info(
                                'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s"',
                                proposalResponses[0].response.status,
                                proposalResponses[0].response.message,
                                proposalResponses[0].response.payload
                            );
                            resolve({ result: true });
                        } else {
                            let emsg =
                                "Could NOT confirm all proposal response as endorsement policy. Msg : " +
                                errMsg[0];
                            logger.error(emsg);
                            throw new Error(emsg);
                        }
                    },
                    (err) => {
                        let emsg = "Failed to install due to error: " + err.stack ? err.stack : err;
                        logger.error(emsg);
                        reject(err);
                    }
                );
        });
    };

    /**
     * 체인코드 인스턴스화
     * param {string} org - 실행사용자의 조직명
     * param {string} upgrade - 신규 설치가 아니라 업그레이드라면 true
     * param {string} chaincodeId - 인스턴스별 체인코드 ID
     * param {string} chaincodeVersion - 설치 버전
     * param {string} initfnc - 인스턴스화할 때의 초기화 함수
     * param {Array<string>} args - 초기화 함수에 전달할 인수 배열
     * param {boolean} get_admin - admin 여부
     */
    vm.instantiate = function (
        org,
        upgrade,
        chaincodeId,
        chaincodeVersion,
        initfnc,
        args,
        get_admin
    ) {
        // logger.info('instantiate called. id: ' +  chaincodeId + ' Ver: ' + chaincodeVersion);
        let client;
        let channel;
        let targets;
        let eventhubs;
        let tx_id;

        return new Promise(function (resolve, reject) {
            helper
                .initObject(ADMIN_USER, org, true, "org")
                .then((clientObj) => {
                    client = clientObj.client;
                    channel = clientObj.channel;
                    targets = clientObj.targets;
                    eventhubs = clientObj.eventhubs;
                    // 1. PeerAdmin 사용자 가져오기. getAdmin 참조
                    let username = "peer" + org + "Admin";
                    return client.getUserContext(username);
                })
                .then(
                    (submitter) => {
                        if (submitter) {
                            return channel.initialize();
                        } else {
                            let emsg = "install ERROR : ***err : Admin need enroll at first.";
                            logger.error(emsg);
                            throw new Error(emsg);
                        }
                    },
                    (err) => {
                        logger.error("Failed to enroll admin. " + err);
                        throw new Error("Failed to enroll admin. " + err);
                    }
                )
                .then(() => {
                    // 5. 체인코드 ID를 지정해 인스턴스화/업그레이드
                    // 보증 정책 지정
                    tx_id = client.newTransactionID();
                    let instantiateRequest = {
                        chaincodeId: chaincodeId,
                        chaincodeVersion: chaincodeVersion,
                        fcn: initfnc,
                        args: args,
                        txId: tx_id,
                        "endorsement-policy": CONFIG.chaincode.endorsement,
                    };
                    // 6. 동일한 체인코드 ID가 존재하면 업그레이드
                    if (upgrade) {
                        logger.info("** update Chaincode");
                        return channel.sendUpgradeProposal(instantiateRequest, 120000);
                    } else {
                        logger.info("** instantiate Chaincode");
                        return channel.sendInstantiateProposal(instantiateRequest, 120000);
                    }
                })
                .then((instResults) => {
                    logger.info("Success instantiate/update Chaincode Proposal");
                    let proposalResponses = instResults[0];

                    let errMsg = [];
                    // 7. invoke와 마찬가지로 proposal결과를 확인
                    if (validateProposal(proposalResponses, targets.length, errMsg)) {
                        logger.info(
                            'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s"',
                            proposalResponses[0].response.status,
                            proposalResponses[0].response.message,
                            proposalResponses[0].response.payload
                        );
                        //success
                        let request = {
                            proposalResponses: proposalResponses,
                            proposal: instResults[1],
                        };
                        let transactionID = tx_id.getTransactionID();
                        let eventPromises = [];
                        let sendPromise = channel.sendTransaction(request);
                        // 8. invoke와 마찬가지로 이벤트 시스템을 통해 트랜잭션 결과를 확인
                        eventhubs.forEach((eh) => {
                            eh.connect();
                            let txPromise = new Promise((resolve, reject) => {
                                let handle = setTimeout(reject, 30000);
                                eh.registerTxEvent(transactionID.toString(), (tx, code) => {
                                    clearTimeout(handle);
                                    eh.unregisterTxEvent(transactionID.toString());

                                    if (code !== "VALID") {
                                        logger.info("Transaction was invalid, code = " + code);
                                        eventhubs.forEach((eh) => {
                                            eh.disconnect();
                                        });
                                        reject({
                                            errorcode: code,
                                            request: request,
                                        });
                                    } else {
                                        logger.info(
                                            "Transaction has been committed on peer " +
                                                eh.getPeerAddr()
                                        );
                                        resolve();
                                    }
                                });
                            });
                            eventPromises.push(txPromise);
                        });

                        return Promise.all([sendPromise].concat(eventPromises))
                            .then((results) => {
                                logger.info("Event promise all complete.");
                                return results[0];
                            })
                            .catch((err) => {
                                eventhubs.forEach((eh) => {
                                    eh.disconnect();
                                });
                                throw err;
                            });
                    } else {
                        var emsg =
                            "Could NOT confirm all proposal response as endorsement policy. Msg : " +
                            errMsg[0];
                        logger.error(emsg);
                        throw new Error(emsg);
                    }
                })
                .then((response) => {
                    // 9. EventHub와의 접속을 해제하고 응답을 반환
                    eventhubs.forEach((eh) => {
                        eh.disconnect();
                    });
                    if (!response) {
                        logger.info("Detected undefined response from eventhub.");
                        resolve({ result: true });
                    } else if (response.status && response.status === "SUCCESS") {
                        logger.info("Successfully sent transaction to the orderer.");
                        logger.info(
                            "******************************************************************"
                        );
                        logger.info("THIS_TX_IS is : ", tx_id);
                        logger.info(
                            "******************************************************************"
                        );
                        resolve({ result: true });
                    } else {
                        let emsg =
                            "Failed to order the transaction. Error code: " + response.status;
                        logger.info(emsg);
                        throw new Error(emsg);
                    }
                })
                .catch((err) => {
                    eventhubs.forEach((eh) => {
                        eh.disconnect();
                    });
                    err.message += "[Error in instantiate/update] " + " [txid is : " + tx_id + "] ";
                    reject(err);
                });
        });
    };

    vm.invoke = function (enrollId, fnc, args, get_admin) {
        let client;
        let channel;
        let targets;
        let eventhubs;
        let tx_id;
        let org = CONFIG.users[enrollId].org;

        return new Promise(function (resolve, reject) {
            helper
                .initObject(enrollId, org, get_admin, "org")
                .then((clientObj) => {
                    client = clientObj.client;
                    channel = clientObj.channel;
                    targets = clientObj.targets;
                    eventhubs = clientObj.eventhubs;

                    let username;
                    if (get_admin) {
                        username = "peer" + org + "Admin";
                    } else {
                        username = enrollId;
                    }
                    return client.getUserContext(username);
                })
                .then(
                    (submitter) => {
                        if (submitter) {
                            // read the config block from the orderer for the channel
                            // and initialize the verify MSPs based on the participating
                            // organizations
                            return channel.initialize();
                        } else {
                            let emsg = "install ERROR : ***err : Admin need enroll at first.";
                            logger.error(emsg);
                            throw new Error(emsg);
                        }
                    },
                    (err) => {
                        logger.error("Failed to enroll admin. " + err);
                        throw new Error("Failed to enroll admin. " + err);
                    }
                )
                .then(
                    () => {
                        // 1. 유니크 트랜잭션 ID를 생성해 호출한 체인코드의 함수명, 인수와 함께 요청을 생성
                        tx_id = client.newTransactionID();
                        let request = {
                            chaincodeId: CONFIG.chaincode.id,
                            fcn: fnc,
                            args: args,
                            txId: tx_id,
                            targets: targets,
                        };

                        // 2. 보증인에게 임시 실행을 요청
                        logger.info("sendTransactionProposal REQUEST:" + JSON.stringify(request));
                        return channel.sendTransactionProposal(request);
                    },
                    (err) => {
                        logger.error("Failed to enroll user. " + err);
                        throw new Error("Failed to enroll user. " + err);
                    }
                )
                .then(
                    (results) => {
                        logger.info("Success sendTransactionProposal");
                        let proposalResponses = results[0];
                        let proposal = results[1];
                        let header = results[2];

                        var errMsg = [];
                        // 3. 임시 실행 결과(Proposal)의 취득과 체크 - validateProposal 함수 참조
                        if (validateProposal(proposalResponses, targets.length, errMsg)) {
                            logger.info(
                                'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s"',
                                proposalResponses[0].response.status,
                                proposalResponses[0].response.message,
                                proposalResponses[0].response.payload
                            );

                            let request = {
                                proposalResponses: proposalResponses,
                                proposal: proposal,
                                header: header,
                            };

                            // set the transaction listener and set a timeout of 30sec for each eventhub
                            // Fail if the transaction did not get committed within the timeout period.
                            let transactionID = tx_id.getTransactionID();
                            let eventPromises = [];
                            // 4. 클라이언트측의 검증이 올바르다면 Proposal 결과 커밋 요청
                            let sendPromise = channel.sendTransaction(request);

                            eventhubs.forEach((eh) => {
                                eh.connect();
                                let txPromise = new Promise((resolve, reject) => {
                                    let handle = setTimeout(reject, 300000);
                                    // 5. 이벤트 시스템(EventHub)을 이용해 트랜잭션 ID 결과를 확인
                                    eh.registerTxEvent(transactionID.toString(), (tx, code) => {
                                        clearTimeout(handle);
                                        eh.unregisterTxEvent(transactionID.toString());
                                        // 6. 하이퍼레저 패브릭측에서 검증 결과 확인
                                        if (code !== "VALID") {
                                            logger.info("Transaction was invalid, code = " + code);
                                            eventhubs.forEach((eh) => {
                                                eh.disconnect();
                                            });
                                            reject({
                                                errorcode: code,
                                                request: request,
                                            });
                                        } else {
                                            logger.info(
                                                "Transaction has been committed on peer " +
                                                    eh.getPeerAddr()
                                            );
                                            resolve();
                                        }
                                    });
                                });
                                eventPromises.push(txPromise);
                            });
                            // 모든 비동기 요청 결과를 기다린 뒤 확인
                            return Promise.all([sendPromise].concat(eventPromises))
                                .then((results) => {
                                    // logger.info('Event promise all complete.');
                                    return results[0];
                                })
                                .catch((err) => {
                                    if (!err) {
                                        logger.error("Detected undefined error.");
                                    } else {
                                        // 7. 병렬 읽기 에러가 발생한 경우 클라이언트 코드와 사용자에 의한 재시도 요청
                                        if (
                                            err.errorcode &&
                                            err.errorcode === "MVCC_READ_CONFLICT"
                                        ) {
                                            //user can retry if he/she wants with this errcode.
                                            logger.error(
                                                "--------------MVCC_READ_CONFLICT-------------------"
                                            );
                                            throw err;
                                        } else {
                                            eventhubs.forEach((eh) => {
                                                eh.disconnect();
                                            });
                                            throw err;
                                        }
                                    }
                                });
                        } else {
                            let emsg =
                                "Could NOT confirm all proposal response as endorsement policy. Msg : " +
                                errMsg[0];
                            logger.error(emsg);
                            throw new Error(emsg);
                        }
                    },
                    (err) => {
                        let emsg =
                            "Failed to send proposal due to error: " + err.stack ? err.stack : err;
                        logger.error(emsg);
                        throw new Error(emsg);
                    }
                )
                .then((response) => {
                    // 8. EventHub과의 접속을 끊고 응답 반환
                    eventhubs.forEach((eh) => {
                        eh.disconnect();
                    });
                    if (!response) {
                        logger.info("Detected undefined response from eventhub.");
                        resolve({ result: true });
                    } else if (response.status && response.status === "SUCCESS") {
                        logger.info("Successfully sent transaction to the orderer.");
                        logger.info(
                            "******************************************************************"
                        );
                        logger.info("THIS_TX_IS is : ", tx_id);
                        logger.info(
                            "******************************************************************"
                        );
                        resolve({ result: true });
                    } else {
                        let emsg =
                            "Failed to order the transaction. Error code: " + response.status;
                        logger.info(emsg);
                        throw new Error(emsg);
                    }
                })
                .catch((err) => {
                    eventhubs.forEach((eh) => {
                        eh.disconnect();
                    });
                    err.message += "[Error in func : " + fnc + "] " + " [txid is : " + tx_id + "] ";
                    reject(err);
                });
        });
    };

    /*
     * validate ProposalResponse for Endorsement Policy
     */
    let validateProposal = (proposalResponses, minCount, errMsg) => {
        if (!proposalResponses && !proposalResponses.length) {
            logger.error("transaction proposal was null");
            return false;
        }
        // 9. 보증인에 의한 임시 실행 결과(Proposal)가 보증 정책에 정해진 규정 수 이상 성공하는 경우에만 검증 성공으로 판단
        // check as endorsement-policy
        var count = 0;
        for (let i in proposalResponses) {
            if (proposalResponses[i].response && proposalResponses[i].response.status === 200) {
                logger.info("transaction proposal : No. %s was good", i);
                count++;
            } else {
                logger.info("transaction proposal : No. %s was bad", i);
                errMsg.push(proposalResponses[i]);
            }
        }

        return count >= minCount;
    };

    vm.query = function (enrollId, fnc, args) {
        let client;
        let channel;
        let targets;
        let tx_id;
        let org = CONFIG.users[enrollId].org;
        logger.info("enrollId:" + enrollId + " fnc:" + fnc + " args:" + args);

        return new Promise(function (resolve, reject) {
            helper
                .initObject(enrollId, org, false)
                .then((clientObj) => {
                    client = clientObj.client;
                    channel = clientObj.channel;
                    targets = clientObj.targets;
                    // 1. 유일한 트랜잭션 ID를 생성하고 호출할 체인코드의 함수명, 인수와 함께 요청을 생성
                    tx_id = client.newTransactionID();

                    return client.getUserContext(enrollId);
                })
                .then((submitter) => {
                    if (submitter) {
                        let req = {
                            chaincodeId: CONFIG.chaincode.id,
                            txId: tx_id,
                            fcn: fnc,
                            args: args,
                            targets: targets,
                        };
                        // 2. 보증인에게 실행을 요청
                        return channel.queryByChaincode(req);
                    } else {
                        let emsg =
                            "[blockchainService] query ERROR :" +
                            fnc +
                            " :enrollID :" +
                            enrollId +
                            " ***err :" +
                            "User need enroll at first";
                        logger.error(emsg);
                        throw new Error(emsg);
                    }
                })
                .then((payloads) => {
                    if (payloads) {
                        logger.info(
                            "Successfully query chaincode on the channel , payload : %s",
                            payloads
                        );
                        //we need only one result from payloads which are originated from several peers
                        // 3. 응답에 포함된 바이트 배열을 문자열로 변환해 반환
                        let result = Array.isArray(payloads) ? payloads[0] : payloads;
                        let buffer = new Buffer(result, "hex");
                        resolve({ result: buffer.toString("utf8") });
                    } else {
                        let emsg =
                            "[blockchainService] query ERROR :" +
                            fnc +
                            " :enrollID :" +
                            enrollId +
                            " ***err :" +
                            "response is null";
                        logger.error(emsg);
                        throw new Error(emsg);
                    }
                })
                .catch((err) => {
                    err.message +=
                        "[" + fnc + "[args : " + args[0] + "] + [txid is : " + tx_id + "] ";
                    reject(err);
                });
        });
    };

    vm.register = function (username, secret) {
        return new Promise(function (resolve, reject) {
            helper
                .register(username, secret)
                .then((secret) => {
                    resolve({ result: secret });
                })
                .catch((err) => {
                    reject(err);
                });
        });
    };
};

module.exports = BlockchainService;
