"use strict";

/**
 * @ngdoc service
 * @name adminApp.voteserv
 * @description
 * # voteserv
 * Factory in the adminApp.
 */
angular.module("adminApp").factory("voteserv", function ($http, $resource) {
    // Service logic
    // ...
    let VOTE_DATA = "VOTE_DATA";

    var storage = {
        votes: [],
        get: function () {
            storage
                ._backEndServer()
                .query()
                .$promise.then(function (data) {
                    storage._saveToLocalStorage(data);
                    angular.copy(storage._getFromLocalStorage(), storage.votes);
                })
                .catch(function (err) {
                    console.log(err);
                });

            return storage.votes;
        },
        remove: function (vote) {
            var idx = storage.votes.findIndex(function (item) {
                return item.v_id === vote.v_id;
            });
            if (idx > -1) {
                storage
                    ._backEndServer()
                    .remove({ v_id: vote.v_id })
                    .$promise.then(function (data) {
                        console.log(data);
                        storage.votes.splice(idx, 1);
                        storage._saveToLocalStorage(storage.votes);
                    });
            }
        },
        add: function (newVote) {
            storage
                ._backEndServer()
                .save(newVote)
                .$promise.then(function (data) {
                    console.log(data);
                });
        },
        update: function () {
            if (arguments.length > 0) {
                var upvote = arguments[0];
                var idx = storage.votes.findIndex(function (item) {
                    return item.v_id === upvote.v_id;
                });
                if (idx > -1) {
                    // update existing value
                    console.log("update value");
                    storage
                        ._backEndServer()
                        .update(upvote)
                        .$promise.then(function (data) {
                            console.log(data);
                        });
                } else {
                    // add new vote
                    console.log("add value");
                    upvote.v_id = Math.random().toString(36).substring(2, 10);
                    this.add(upvote);
                }
            }
        },
        verify: function (v_id) {
            return storage._backEndServer().get({ a: "ver", b: v_id });
        },
        _saveToLocalStorage: function (data) {
            localStorage.setItem(VOTE_DATA, JSON.stringify(data));
        },
        _getFromLocalStorage: function () {
            return JSON.parse(localStorage.getItem(VOTE_DATA));
        },
        _backEndServer: function () {
            return $resource(
                "/adm/:u_id/:a",
                { u_id: "admin", a: null },
                { update: { method: "PUT" } }
            );
        },
    };
    return storage;
});
