"use strict";

/**
 * @ngdoc function
 * @name adminApp.controller:VoteviewCtrl
 * @description
 * # VoteviewCtrl
 * Controller of the adminApp
 */
angular
    .module("adminApp")
    .controller("VoteviewCtrl", function ($scope, $location, $filter, voteserv) {
        $scope.votes = voteserv.get();
        $scope.now = $filter("date")(new Date(), "yyyy-MM-dd HH:mm:ss");
        $scope.add = function (view) {
            let vote = {
                v_id: "",
                name: "",
                start: "",
                end: "",
                ageLimit: 0,
                sexLimit: "0",
                contents: { "새 내용": 0 },
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
        $scope.modify = function (view, vote) {
            if ($scope.now < vote.start) {
                $location.path(view).search({ param: JSON.stringify(vote) });
            } else {
                window.alert("진행/종료 상태인 투표는 수정이 불가능합니다.");
            }
        };
        $scope.showresult = function (view, vote) {
            $location.path(view).search({ param: JSON.stringify(vote) });
        };
    });
