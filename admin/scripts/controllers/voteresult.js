"use strict";

/**
 * @ngdoc function
 * @name adminApp.controller:VoteresultCtrl
 * @description
 * # VoteresultCtrl
 * Controller of the adminApp
 */
angular.module("adminApp").controller("VoteresultCtrl", function ($scope, $location) {
    $scope.vote = JSON.parse($location.search().param);
    $scope.contents = $scope.vote.contents;
    $scope.sum = 0;

    // calculate sum
    for (var key of Object.keys($scope.contents)) {
        $scope.sum += $scope.contents[key];
    }
});