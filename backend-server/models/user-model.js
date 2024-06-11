const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
	name: { type: String, required: true },
	email: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	organization: { type: String, required: true, default: "org1"},
	role: { type: String, enum: ["user", "admin"], default: "user" },
	votedAgendas: { type: [mongoose.Schema.Types.ObjectId], ref: "Agenda" },
});

// Hash the password before saving the user
userSchema.pre("save", async function (next) {
	if (this.isModified("password") || this.isNew) {
		const salt = await bcrypt.genSalt(10);
		this.password = await bcrypt.hash(this.password, salt);
	}
	next();
});

module.exports = mongoose.model("User", userSchema);
