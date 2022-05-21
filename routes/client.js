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
            console.log(results);
            res.send(results);
        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        });
});
router.post("/:u_id/his", function (req, res, next) {
    var data = req.body;
    data.u_name = req.params.u_id;
    mysql
        .addHistory(data)
        .then(function (results) {
            console.log(results);
            res.send(results);
        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
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
            console.log(err);
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
            console.log(dataList);
            res.send(dataList);
        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        });
});
router.get("/:u_id/histories", function (req, res, next) {
    mysql.getHistory().then(function (results) {
        var dataList = [];
        for (var data of results) {
            dataList.push(JSON.parse(JSON.stringify(data)));
        }
        console.log(dataList);
        res.send(dataList);
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

// HyperLedgerFabric connection
// fetch vote list from fabric

// Verify DB with BlockChain
router.get("/:u_id/verify", function (req, res, next) {
    console.log("will do");
    res.send("will do");
});

module.exports = router;
