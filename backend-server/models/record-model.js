const mongoose = require("mongoose");

const RecordSchema = new mongoose.Schema({
	agendaId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Agenda",
		required: true,
	},
	organizationHash: { type: String, required: true },
	selectedOption: { type: String, required: true },
	createdAt: { type: Date, default: Date.now, required: true },
	salt: { type: String, required: true },
});

module.exports = mongoose.model("Record", RecordSchema);
