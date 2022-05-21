var express = require("express");
var router = express.Router();

/* GET home page. */
router.get("/", function (req, res, next) {
    res.render("client/views/index");
});

router.get("/a", function (req, res, next) {
    res.render("admin/views/index");
});

module.exports = router;
