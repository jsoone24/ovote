var express = require("express");
const { route } = require(".");
var mysql = require("../server/mysql");
var router = express.Router();

var BlockchainService = require("../server/common/blockchain-service");
var service = new BlockchainService();
var utils = require("fabric-client/lib/utils.js");
var logger = utils.getLogger("index");

/* GET users listing. */
// POST : CREATE
// create new vote
router.post("/:u_id", function (req, res, next) {
    mysql
        .addVote(data)
        .then(function (results) {
            //console.log(results);
            res.send(results);
        })
        .catch(function (err) {
            //console.log(err);
            res.send(err);
        });
});
router.post("/:u_id/his", function (req, res, next) {
    var u_name = req.params.u_id;
    var data = req.body;
    var block = {
        HId: req.body.h_id,
        VId: req.body.v_id,
        OwnerId: u_name,
        Content: req.body.content,
    };
    data.u_name = u_name;

    /**
     * add vote on fabric
     */
    service
        .invoke("serv1", "AddVote", [JSON.stringify(block)], false)
        .then(
            (resp) => {
                console.log(resp);
            },
            (err) => {
                logger.error("Failed to invoke: " + JSON.stringify(err));
                res.status(500).json(err);
            }
        )
        .then(function () {
            mysql
                .addHistory(data)
                .then(function (results) {
                    //console.log(results);
                    res.send(results);
                })
                .catch(function (err) {
                    console.log(err);
                    res.send(err);
                });
        });
});

// GET : READ
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
            //console.log(err);
            res.send(err);
        });
});
router.get("/:u_id/users", function (req, res, next) {
    mysql
        .getUsers()
        .then(function (results) {
            var dataList = [];
            for (var data of results) {
                dataList.push(JSON.parse(JSON.stringify(data)));
            }
            //console.log(dataList);
            res.send(dataList);
        })
        .catch(function (err) {
            //console.log(err);
            res.send(err);
        });
});
router.get("/:u_id/his/db", function (req, res, next) {
    mysql.getHistory().then(function (results) {
        var dataList = [];
        for (var data of results) {
            dataList.push(JSON.parse(JSON.stringify(data)));
        }
        //console.log(dataList);
        res.send(dataList);
    });
});
router.get("/:u_id/his/bc", function (req, res, next) {
    /**
     * fetch vote list from fabric
     */
    service
        .query("serv1", "ListVotes", [])
        .then((resp) => {
            var result = JSON.parse(resp.result);
            console.log(result);
            res.send(result);
            //res.send(JSON.parse(result));
        })
        .catch(function (err) {
            console.log(err);
        });
});

// PUT : UPDATE
// certain v_id
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
// certain v_id
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
