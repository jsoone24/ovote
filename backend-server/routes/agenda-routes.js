const express = require("express");
const router = express.Router();
const agendaController = require("../controllers/agenda-controller");
const auth = require("../middleware/auth");

router.post("/", auth, agendaController.createAgenda);
router.get("/", auth, agendaController.getAgenda);
router.get("/:id", auth, agendaController.getAgendaById);
router.put("/:id", auth, agendaController.updateAgenda);
router.delete("/:id", auth, agendaController.deleteAgenda);
router.get("/verify/:id", auth, agendaController.verifyAgenda);

module.exports = router;
