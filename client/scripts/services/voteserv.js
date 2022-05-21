"use strict";

/**
 * @ngdoc service
 * @name clientApp.voteserv
 * @description
 * # voteserv
 * Factory in the clientApp.
 */
angular.module("clientApp").factory("voteserv", function ($http, $resource) {
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
                    })
                    .catch(function (err) {
                        console.log(err);
                    });
            }
        },
        add: function (newVote) {
            storage
                ._backEndServer()
                .save(newVote)
                .$promise.then(function (data) {
                    console.log(data);
                })
                .catch(function (err) {
                    console.log(err);
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
                        })
                        .catch(function (err) {
                            console.log(err);
                        });
                } else {
                    // add new vote
                    console.log("add value");
                    upvote.v_id = Math.random().toString(36).substring(2, 10);
                    this.add(upvote);
                }
            }
        },
        addHistory: function (selection, v_id) {
            var h_id = Math.random().toString(36).substring(2, 10);
            storage
                ._backEndServer()
                .save({ p: "his" }, { v_id: v_id, content: selection, h_id: h_id })
                .$promise.then(function (data) {
                    console.log(data);
                })
                .catch(function (err) {
                    console.log(err);
                });
        },
        verify: function () {
            console.log("will do");
        },
        _saveToLocalStorage: function (data) {
            localStorage.setItem(VOTE_DATA, JSON.stringify(data));
        },
        _getFromLocalStorage: function () {
            return JSON.parse(localStorage.getItem(VOTE_DATA));
        },
        _backEndServer: function () {
            return $resource(
                "/cli/:u_id/:p",
                { u_id: "serv1", p: null },
                { update: { method: "PUT" } }
            );
        },
    };
    return storage;
});
