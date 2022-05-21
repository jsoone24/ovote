"use strict";

/**
 * @ngdoc function
 * @name clientApp.controller:VotelistCtrl
 * @description
 * # VotelistCtrl
 * Controller of the clientApp
 */
angular.module("clientApp").controller("VotelistCtrl", function ($scope, $location, voteserv) {
    $scope.votes = voteserv.get();
    $scope.refresh = function () {
        voteserv.get();
    };
    $scope.changeView = function (view, vote) {
        $location.path(view).search({ param: JSON.stringify(vote) });
    };
});
