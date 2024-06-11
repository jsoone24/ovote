const mongoose = require("mongoose");

const agendaSchema = new mongoose.Schema({
	title: { type: String, required: true },
	description: { type: String },
	startTime: { type: Date, required: true },
	endTime: { type: Date, required: true },
	createdOrg: { type: String, required: true },
	createdAt: { type: Date, default: Date.now, required: true },
	lastVerificationTime: { type: Date, default: "" },
	lastRecordTime: { type: Date, default: "" },
	isVerified: { type: Boolean, default: false },
	options: [
		{
			option: String,
			description: String,
			photoUrl: String,
			votes: { type: Number, default: 0 },
		},
	],
});

module.exports = mongoose.model("Agenda", agendaSchema);
