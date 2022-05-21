"use strict";

/**
 * @ngdoc overview
 * @name adminApp
 * @description
 * # adminApp
 *
 * Main module of the application.
 */

/* url in when is used only by the anular */
/* templateUrl sends request to express server. server responds based on the url which templateUrl required */
angular
    .module("adminApp", [
        "ngAnimate",
        "ngCookies",
        "ngResource",
        "ngRoute",
        "ngSanitize",
        "ngTouch",
    ])
    .config(function ($routeProvider) {
        $routeProvider
            .when("/admin/voteManage/", {
                templateUrl: "admr/views/votemanage.html",
                controller: "VotemanageCtrl",
                controllerAs: "voteManage",
            })
            .when("/admin/voteResult", {
                templateUrl: "admr/views/voteresult.html",
                controller: "VoteresultCtrl",
                controllerAs: "voteResult",
            })
            .when("/admin/voteView", {
                templateUrl: "admr/views/voteview.html",
                controller: "VoteviewCtrl",
                controllerAs: "voteView",
            })
            .otherwise({
                redirectTo: "/admin/voteView",
            });
    });
