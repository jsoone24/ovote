"use strict";

/**
 * @ngdoc function
 * @name adminApp.controller:VotemanageCtrl
 * @description
 * # VotemanageCtrl
 * Controller of the adminApp
 */
angular
    .module("adminApp")
    .controller("VotemanageCtrl", function ($scope, $location, $filter, $interval, voteserv) {
        $scope.vote = JSON.parse($location.search().param);
        $scope.contents = $scope.vote.contents;
        $scope.now = $filter("date")(new Date(), "yyyy-MM-dd HH:mm:ss");
        $interval(function () {
            $scope.now = $filter("date")(new Date(), "yyyy-MM-dd HH:mm:ss");
        }, 1000);
        $scope.vote.start = new Date($scope.vote.start);
        $scope.vote.end = new Date($scope.vote.end);
        $scope.status = "";

        $scope.deleteContent = function (key) {
            if (Object.keys($scope.contents).length > 1) {
                delete $scope.contents[key];
            }
        };
        $scope.addContent = function (newContentDes) {
            $scope.contents[newContentDes] = 0;
            $scope.newContentDes = "";
        };
        $scope.updateContent = function (key, idx) {
            if (!$scope.contents.hasOwnProperty(key)) {
                $scope.addContent(key);
                $scope.deleteContent(Object.keys($scope.contents)[idx]);
            }
        };
        $scope.done = function () {
            if ($scope.vote.start > $scope.vote.end) {
                window.alert("시작 날짜는 종료 날짜 전이어야 합니다.");
            } else {
                $scope.vote.start = $filter("date")($scope.vote.start, "yyyy-MM-dd HH:mm:ss");
                $scope.vote.end = $filter("date")($scope.vote.end, "yyyy-MM-dd HH:mm:ss");
                voteserv.update($scope.vote);
                $location.path("admin/voteView");
            }
        };
    });
