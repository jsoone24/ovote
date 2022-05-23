"use strict";

/**
 * @ngdoc function
 * @name clientApp.controller:VotepageCtrl
 * @description
 * # VotepageCtrl
 * Controller of the clientApp
 */
angular
    .module("clientApp")
    .controller("VotepageCtrl", function ($scope, $location, $filter, $interval, voteserv) {
        $scope.vote = JSON.parse($location.search().param);
        $scope.contents = $scope.vote.contents;
        $scope.now = $filter("date")(new Date(), "yyyy-MM-dd HH:mm:ss");
        $interval(function () {
            $scope.now = $filter("date")(new Date(), "yyyy-MM-dd HH:mm:ss");
        }, 1000);
        $scope.select = 0;

        $scope.leave = function () {
            var selection = Object.keys($scope.contents)[$scope.select];
            $scope.vote.contents[selection] += 1;
            voteserv.update($scope.vote);
            voteserv.addHistory(selection, $scope.vote.v_id);
            $location.path("/voteComplete");
        };
    });
