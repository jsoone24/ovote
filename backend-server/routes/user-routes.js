const express = require("express");
const router = express.Router();
const userController = require("../controllers/user-controller");
const auth = require("../middleware/auth");

router.post("/signup", userController.createUser);
router.post("/login", userController.loginUser);
router.post("/recover", userController.recoverPassword);
router.post("/reset", userController.resetPassword);
router.get("/", auth, userController.getUsers);
router.get("/:id", auth, userController.getUserById);
router.put("/:id", auth, userController.updateUser);
router.delete("/:id", auth, userController.deleteUser);

module.exports = router;
