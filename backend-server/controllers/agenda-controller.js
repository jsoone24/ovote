const Agenda = require("../models/agenda-model");
const { verifyAgendaConsistency } = require("../services/verification-service");

exports.createAgenda = async (req, res) => {
	try {
		const agenda = new Agenda(req.body);
		const savedAgenda = await agenda.save();
		res.status(201).send(savedAgenda);
	} catch (error) {
		console.error("Failed to create agenda", error);
		res.status(500).send("Failed to create agenda");
	}
};

exports.getAgenda = async (req, res) => {
	try {
		const agendas = await Agenda.find();
		res.status(200).send(agendas);
	} catch (error) {
		console.error("Failed to get agendas", error);
		res.status(500).send("Failed to get agendas");
	}
};

exports.getAgendaById = async (req, res) => {
	const id = req.params.id;
	try {
		const agenda = await Agenda.findById(id);
		if (!agenda) {
			return res.status(404).send("Agenda not found");
		}
		res.status(200).send(agenda);
	} catch (error) {
		console.error("Failed to get agenda", error);
		res.status(500).send("Failed to get agenda");
	}
};

exports.updateAgenda = async (req, res) => {
	const id = req.params.id;
	try {
		const agenda = await Agenda.findByIdAndUpdate(id, req.body, {
			new: true,
		});
		if (!agenda) {
			return res.status(404).send("Agenda not found");
		}
		res.status(200).send(agenda);
	} catch (error) {
		console.error("Failed to update agenda", error);
		res.status(500).send("Failed to update agenda");
	}
};

exports.deleteAgenda = async (req, res) => {
	const id = req.params.id;
	try {
		const agenda = await Agenda.findByIdAndDelete(id);
		if (!agenda) {
			return res.status(404).send("Agenda not found");
		}
		res.status(200).send("Agenda deleted");
	} catch (error) {
		console.error("Failed to delete agenda", error);
		res.status(500).send("Failed to delete agenda");
	}
};

exports.verifyAgenda = async (req, res) => {
	const agendaId = req.params.id;
	const force = req.query.force === "true";
	try {
		const verificationResult = await verifyAgendaConsistency(
			agendaId,
			force
		);
		console.log("Verification result", verificationResult);
		res.send(verificationResult);
	} catch (error) {
		console.error("Verification failed", error);
		res.status(500).json({ error: "Verification failed" });
	}
};
