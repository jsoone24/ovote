const express = require("express");
const router = express.Router();
const recordController = require("../controllers/record-controller");

router.post("/", recordController.createRecord);
router.get("/database", recordController.getDatabaseRecord);
router.get("/blockchain", recordController.getBlockchainRecord);

module.exports = router;
