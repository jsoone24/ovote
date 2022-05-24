var express = require("express");
var mysql = require("../server/mysql");
var router = express.Router();

var BlockchainService = require("../server/common/blockchain-service");
var service = new BlockchainService();
var utils = require("fabric-client/lib/utils.js");
var logger = utils.getLogger("index");

let util = require("../server/util/util");

/* GET users listing. */
// POST : CREATE
// create new vote
router.post("/:u_id", function (req, res, next) {
    var data = req.body;
    data.contents = JSON.stringify(data.contents);
    mysql
        .addVote(data)
        .then(function (results) {
            res.send(results);
        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        });
});

// GET : READ
// get vote list
router.get("/:u_id", function (req, res, next) {
    mysql
        .getVotes()
        .then(function (results) {
            var dataList = [];
            for (var data of results) {
                let temp = JSON.parse(JSON.stringify(data));
                temp.contents = JSON.parse(temp.contents);
                dataList.push(temp);
            }
            res.send(dataList);
        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        });
});
// get user list
router.get("/:u_id/users", function (req, res, next) {
    mysql
        .getUsers()
        .then(function (results) {
            var dataList = [];
            for (var data of results) {
                dataList.push(JSON.parse(JSON.stringify(data)));
            }

            res.send(dataList);
        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        });
});
// get history
router.get("/:u_id/his", function (req, res, next) {
    mysql.getHistory().then(function (results) {
        var dataList = [];
        for (var data of results) {
            dataList.push(JSON.parse(JSON.stringify(data)));
        }

        res.send(dataList);
    });
});
// verify DB and BlockChain
router.get("/:u_id/ver", function (req, res, next) {
    var vid = req.query.b;
    var dbHis = [];
    var dbV = [];
    var bcHis = [];
    var dbHisQuery = mysql.getHistory().then(
        function (results) {
            for (var data of results) {
                var t = JSON.parse(JSON.stringify(data));
                if (t.v_id === vid) {
                    dbHis.push(t);
                }
            }

            return true;
        },
        (err) => {
            console.log(err);
            return false;
        }
    );
    var dbVoteQuery = mysql.getVote(vid).then(
        function (results) {
            dbV = JSON.parse(results[0].contents);

            return true;
        },
        (err) => {
            console.log(err);
            return false;
        }
    );
    var bc = service.query("admin", "ListVotes", []).then(
        (resp) => {
            for (var data of JSON.parse(resp.result)) {
                if (data.VId === vid) {
                    bcHis.push(data);
                }
            }

            return true;
        },
        (err) => {
            console.log(err);
            return false;
        }
    );

    Promise.all([dbHisQuery, dbVoteQuery, bc])
        .then(function (values) {
            console.log(values);
            var result = true;
            if (!values.every((element) => element === true)) {
                result = false;
                res.json({ msg: result });
                return false;
            }
            var dbHisRes = {};
            var bcHisRes = {};
            keys = Object.keys(dbV);
            // init each objects
            for (let d of keys) {
                dbHisRes[d] = 0;
                bcHisRes[d] = 0;
            }
            // collect values of dbHis
            dbHis.forEach((value, index, array) => {
                dbHisRes[value.content] += 1;
            });
            // collect values of bcHis
            bcHis.forEach((value, index, arrray) => {
                bcHisRes[value.Content] += 1;
            });
            console.log(dbV, dbHisRes, bcHisRes);
            for (let d of keys) {
                let t = [dbHisRes[d], bcHisRes[d], dbV[d]];
                console.log(t, Math.min(...t), Math.max(...t));
                if (Math.min(...t) !== Math.max(...t)) {
                    result = false;
                    break;
                }
            }
            res.json({ msg: result });
        })
        .catch((err) => {
            console.log(err);
            res.json({ msg: result });
        });
});

// PUT : UPDATE
// update certain v_id
router.put("/:u_id", function (req, res, next) {
    var data = req.body;
    data.contents = JSON.stringify(data.contents);
    mysql
        .updateVote(data)
        .then(function (results) {
            console.log(results);
            res.send(results);
        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        });
});

// DELETE : DELETE
// delete certain v_id
router.delete("/:u_id", function (req, res, next) {
    console.log(req.params.u_id, req.query.v_id);
    mysql
        .deleteVote(req.query.v_id)
        .then(function (results) {
            console.log(results);
            res.send(results);
        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        });
});

module.exports = router;
