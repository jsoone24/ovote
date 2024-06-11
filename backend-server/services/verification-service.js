const Agenda = require("../models/agenda-model");
const Record = require("../models/record-model");
const fabricGateway = require("./fabric-gateway-service");

async function verifyAgendaConsistency(agendaId, force = false) {
	try {
		// Get agenda from MongoDB
		const agenda = await Agenda.findById(agendaId);
		if (!agenda) {
			throw new Error("Agenda not found");
		}

		// Compare LastVerificationTime and LastRecordTime first if not forcing verification
		if (!force) {
			console.log(
				agenda.lastVerificationTime,
				agenda.lastRecordTime,
				agenda.isVerified
			);
			const LastVerificationTime = agenda.lastVerificationTime;
			const LastRecordTime = agenda.lastRecordTime;

			if (
				LastVerificationTime > LastRecordTime &&
				agenda.isVerified !== null
			) {
				// Cache Hit
				return agenda.isVerified;
			}
		}

		// Cache miss
		// Get records from MongoDB
		const records = await Record.find({ agendaId: agendaId });

		// Get records from Blockchain
		const blockchainRecords = await fabricGateway.readFromBlockchain(
			agendaId
		);

		// Verify consistency
		const agendaResults = calculateResultsFromAgenda(agenda.options);
		const mongoResults = calculateResults(records, agenda.options);
		const blockchainResults = calculateResults(
			blockchainRecords,
			agenda.options
		);

		console.log(agendaResults, mongoResults, blockchainResults);
		const isConsistent = compareResults(
			mongoResults,
			blockchainResults,
			agendaResults
		);

		agenda.isVerified = isConsistent;
		agenda.lastVerificationTime = new Date();
		agenda.save();

		return isConsistent;
	} catch (error) {
		throw new Error(`Verification failed: ${error.message}`);
	}
}

function calculateResults(records, options = []) {
	const results = {};
	options.forEach((option) => {
		results[option.option] = 0;
	});
	if (records && records.length > 0) {
		records.forEach((record) => {
			if (!results[record.selectedOption]) {
				results[record.selectedOption] = 0;
			}
			results[record.selectedOption]++;
		});
	}
	return results;
}

function calculateResultsFromAgenda(options) {
	const results = {};
	if (!options || options.length === 0) {
		return results;
	}
	options.forEach((option) => {
		results[option.option] = option.votes;
	});
	return results;
}

function compareResults(mongoResults, blockchainResults, agendaResults) {
	return (
		JSON.stringify(mongoResults) === JSON.stringify(blockchainResults) &&
		JSON.stringify(mongoResults) === JSON.stringify(agendaResults)
	);
}

module.exports = { verifyAgendaConsistency };
