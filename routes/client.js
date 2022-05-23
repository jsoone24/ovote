var express = require("express");
var mysql = require("../server/mysql");
var router = express.Router();

var BlockchainService = require("../server/common/blockchain-service");
var service = new BlockchainService();
var utils = require("fabric-client/lib/utils.js");
var logger = utils.getLogger("index");

/* GET users listing. */
// POST : CREATE
// create new history
router.post("/:u_id/his", function (req, res, next) {
    var u_name = req.params.u_id;
    var data = req.body;
    var hid = Math.random().toString(36).substring(2, 10);

    var block = {
        HId: hid,
        VId: req.body.v_id,
        OwnerId: u_name,
        Content: req.body.content,
    };
    data.u_name = u_name;
    data.h_id = hid;

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
// query all votes
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
// query all users
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
// query all histories
router.get("/:u_id/his", function (req, res, next) {
    if (req.query.b === "db") {
        mysql.getHistory().then(function (results) {
            var dataSet = [];
            for (var data of results) {
                var t = JSON.parse(JSON.stringify(data));
                if (t.u_name === req.params.u_id) {
                    dataSet.push(t.v_id);
                }
            }
            res.send(dataSet);
        });
    } else if (req.query.b === "bc") {
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
    }
});

// PUT : UPDATE
// update vote by v_id
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
// nothing

module.exports = router;
