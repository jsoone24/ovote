const Record = require("../models/record-model");
const User = require("../models/user-model");
const rabbitmqService = require("../services/rabbitmq-service");
const fabricGateway = require("../services/fabric-gateway-service");

exports.createRecord = async (req, res) => {
	try {
		const { userId, agendaId, selectedOption } = req.body;
		const user = await User.findById(userId);
		if (!user || user.votedAgendas.includes(agendaId)) {
			return res.status(400).send("User not allowed to vote");
		}

		try {
			const organization = user.organization;
			await rabbitmqService.sendMessage({
				organization,
				agendaId,
				selectedOption,
			});
			console.log("Data sent to rabbit queue");
		} catch (error) {
			console.error("Failed to send data to queue", error);
		}

		user.votedAgendas.push(agendaId);
		const updatedUser = await user.save();

		res.status(201).send(updatedUser);
	} catch (error) {
		console.error("Failed to create record", error);
		res.status(500).send("Failed to create record");
	}
};

exports.getDatabaseRecord = async (req, res) => {
	try {
		const records = await Record.find();
		res.status(200).send(records);
	} catch (error) {
		console.error("Failed to get database record", error);
		res.status(500).send("Failed to get database record");
	}
};

exports.getBlockchainRecord = async (req, res) => {
	try {
		const records = await fabricGateway.readAllFromBlockchain();
		res.status(200).send(records);
	} catch (error) {
		console.error("Failed to get blockchain record", error);
		res.status(500).send("Failed to get blockchain record");
	}
};
