/*
 * Fabric Client Sample User Registration Script
 */

"use strict";
let BlockchainService = require("../common/blockchain-service");
let service = new BlockchainService();
let config = require("config");
let ASSET = config.asset;
let USERS = config.users;
let promises = [];

function registerUser(username) {
    //register user
    let regprom = service.register(username, ASSET.users[username].secret).then(
        (rres) => {
            console.log("success register." + rres.result);
        },
        (err) => {
            console.log("Failed  user : " + JSON.stringify(err.stack ? err.stack : err.message));
        }
    );
    promises.push(regprom);
}

var lenUser = 0;
for (let user in USERS) {
    lenUser++;
    console.log("registerUser-" + "user:" + user + " cnt:" + lenUser);
    registerUser(user);
}
Promise.all(promises).then(function (values) {
    console.log("Promise.all cnt:" + lenUser);
    process.exit(0);
});
