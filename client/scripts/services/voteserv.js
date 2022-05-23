"use strict";

/**
 * @ngdoc service
 * @name clientApp.voteserv
 * @description
 * # voteserv
 * Factory in the clientApp.
 */
/* 
angular $resource - $http match table
'get'    : {method:'GET'},                  // get individual record
'save'   : {method:'POST'},                 // create record
'query'  : {method:'GET', isArray:true},    // get list all records
'remove' : {method:'DELETE'},               // remove record
'delete' : {method:'DELETE'},               // same, remove record
'update' : {method:'PUT'}};                 // update record
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
                    return null;
                }
            }
            return null;
        },
        addHistory: function (selection, v_id) {
            storage
                ._backEndServer()
                .save({ a: "his" }, { v_id: v_id, content: selection })
                .$promise.then(function (data) {
                    console.log(data);
                })
                .catch(function (err) {
                    console.log(err);
                });
        },
        getHistory: function () {
            return storage._backEndServer().query({ a: "his", b: "db" });
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
                "/cli/:u_id/:a",
                { u_id: "serv1", a: null },
                { update: { method: "PUT" } }
            );
        },
    };
    return storage;
});
