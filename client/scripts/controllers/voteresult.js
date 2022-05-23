"use strict";

/**
 * @ngdoc function
 * @name clientApp.controller:VoteresultCtrl
 * @description
 * # VoteresultCtrl
 * Controller of the clientApp
 */
angular.module("clientApp").controller("VoteresultCtrl", function ($scope, $filter, $location) {
    $scope.vote = JSON.parse($location.search().param);
    $scope.contents = $scope.vote.contents;
    $scope.now = $filter("date")(new Date(), "yyyy-MM-dd HH:mm:ss");
    $scope.sum = 0;

    // calculate sum
    for (var key of Object.keys($scope.contents)) {
        $scope.sum += $scope.contents[key];
    }
});
