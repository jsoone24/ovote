"use strict";

/**
 * @ngdoc function
 * @name clientApp.controller:VotelistCtrl
 * @description
 * # VotelistCtrl
 * Controller of the clientApp
 */
angular
    .module("clientApp")
    .controller("VotelistCtrl", function ($scope, $location, $interval, $filter, voteserv) {
        $scope.votes = voteserv.get();
        $scope.history = voteserv.getHistory();
        $scope.history.$promise.then(function (data) {
            $scope.history = data;
        });
        $scope.now = $filter("date")(new Date(), "yyyy-MM-dd HH:mm:ss");
        $interval(function () {
            $scope.now = $filter("date")(new Date(), "yyyy-MM-dd HH:mm:ss");
        }, 1000);
        $scope.refresh = function () {
            voteserv.get();
        };
        $scope.goVote = function (view, vote) {
            if ($scope.now > vote.start && $scope.now < vote.end) {
                if ($scope.history.indexOf(vote.v_id) > -1) {
                    window.alert("이미 투표하신 안건 입니다.");
                } else {
                    $location.path(view).search({ param: JSON.stringify(vote) });
                }
            } else {
                window.alert("시작전/종료 상태인 안건은 투표가 불가능합니다.");
            }
        };
        $scope.checkVoted = function (v_id) {
            if ($scope.history.indexOf(v_id) > -1) {
                return "투표 완료";
            } else {
                return "투표 전";
            }
        };
        $scope.showresult = function (view, vote) {
            $location.path(view).search({ param: JSON.stringify(vote) });
        };
    });
