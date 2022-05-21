"use strict";

/**
 * @ngdoc function
 * @name adminApp.controller:VoteviewCtrl
 * @description
 * # VoteviewCtrl
 * Controller of the adminApp
 */
angular.module("adminApp").controller("VoteviewCtrl", function ($scope, $location, voteserv) {
    $scope.votes = voteserv.get();
    $scope.status = "";
    $scope.verifyResult = null;
    $scope.add = function (view) {
        let vote = {
            v_id: "",
            name: "",
            start: "",
            end: "",
            ageLimit: 0,
            sexLimit: "0",
            contents: { 내용1: 0 },
        };
        console.log(typeof vote);
        $location.path(view).search({ param: JSON.stringify(vote) });
    };
    $scope.delete = function (vote) {
        voteserv.remove(vote);
    };
    $scope.refresh = function () {
        voteserv.get();
    };
    $scope.changeView = function (view, vote) {
        $location.path(view).search({ param: JSON.stringify(vote) });
    };
    $scope.verify = function () {
        voteserv.verify();
        console.log("will do");
    };
});
