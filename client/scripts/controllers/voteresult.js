"use strict";

/**
 * @ngdoc function
 * @name clientApp.controller:VoteresultCtrl
 * @description
 * # VoteresultCtrl
 * Controller of the clientApp
 */
angular
    .module("clientApp")
    .controller("VoteresultCtrl", function ($scope, $filter, $interval, $location, voteserv) {
        $scope.vote = JSON.parse($location.search().param);
        $scope.contents = $scope.vote.contents;
        $scope.now = $filter("date")(new Date(), "yyyy-MM-dd HH:mm:ss");
        $interval(function () {
            $scope.now = $filter("date")(new Date(), "yyyy-MM-dd HH:mm:ss");
        }, 1000);
        $scope.sum = 0;
        $scope.verifyResult = "검증되지 않았습니다";

        $scope.verify = function () {
            $scope.verifyResult = "검증 중 입니다...";
            voteserv.verify($scope.vote.v_id).$promise.then(function (data) {
                $scope.verifyResult = data.msg;
            });
        };
        // calculate sum
        for (var key of Object.keys($scope.contents)) {
            $scope.sum += $scope.contents[key];
        }
    });
