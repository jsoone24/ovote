"use strict";

/**
 * @ngdoc overview
 * @name clientApp
 * @description
 * # clientApp
 *
 * Main module of the application.
 */
angular
    .module("clientApp", [
        "ngAnimate",
        "ngCookies",
        "ngResource",
        "ngRoute",
        "ngSanitize",
        "ngTouch",
    ])
    .config(function ($routeProvider) {
        $routeProvider
            .when("/", {
                templateUrl: "clir/views/votelist.html",
                controller: "VotelistCtrl",
                controllerAs: "votelist",
            })
            .when("/votePage", {
                templateUrl: "clir/views/votepage.html",
                controller: "VotepageCtrl",
                controllerAs: "votePage",
            })
            .when("/voteResult", {
                templateUrl: "clir/views/voteresult.html",
                controller: "VoteresultCtrl",
                controllerAs: "voteResult",
            })
            .when("/voteComplete", {
                templateUrl: "clir/views/votecomplete.html",
            })
            .otherwise({
                redirectTo: "/",
            });
    });
