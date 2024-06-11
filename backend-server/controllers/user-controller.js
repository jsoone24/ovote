const User = require("../models/user-model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

exports.createUser = async (req, res) => {
	try {
		const { name, email, password, organization } = req.body;

		// Check duplicate Email address
		const existingUser = await User.findOne({ email });
		if (existingUser) return res.status(400).send("Email already in use");

		const newUser = new User({ name, email, password, organization });
		await newUser.save();

		res.status(201).send("User registered successfully");
	} catch (err) {
		console.error("Error registering user", err);
		res.status(400).send("Error registering user");
	}
};

exports.getUsers = async (req, res) => {
	try {
		const users = await User.find();
		res.status(200).send(users);
	} catch (error) {
		console.error("Failed to get users", error);
		res.status(500).json("Failed to get users");
	}
};

exports.getUserById = async (req, res) => {
	const id = req.params.id;
	try {
		const user = await User.findById(id);
		if (!user) {
			return res.status(404).send("User not found");
		}
		res.status(200).send(user);
	} catch (error) {
		console.error("Failed to get user", error);
		res.status(500).send("Failed to get user");
	}
};

exports.updateUser = async (req, res) => {
	const id = req.params.id;
	const updates = req.body;
	try {
		const user = await User.findById(userId);
		if (!user) return res.status(404).send("User not found");

		Object.keys(updates).forEach((key) => {
			user[key] = updates[key];
		});

		await user.save();
		res.status(200).send(user);
	} catch (error) {
		console.error("Failed to update user", error);
		res.status(500).send("Failed to update user");
	}
};

exports.deleteUser = async (req, res) => {
	const id = req.params.id;
	try {
		const user = await User.findByIdAndDelete(id);
		if (!user) {
			return res.status(404).send("User not found");
		}
		res.status(200).send("User deleted");
	} catch (error) {
		console.error("Failed to delete user", error);
		res.status(500).send("Failed to delete user");
	}
};

exports.loginUser = async (req, res) => {
	try {
		const { email, password } = req.body;
		const user = await User.findOne({ email: email });
		if (!user) return res.status(401).send("Invalid credentials");

		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) return res.status(401).send("Invalid credentials");

		const token = jwt.sign({ user: user }, process.env.JWT_SECRET, {
			expiresIn: "1h",
		});
		res.json({ token });
	} catch (err) {
		console.error("Error logging in", err);
		res.status(500).send("Error logging in");
	}
};

exports.recoverPassword = async (req, res) => {
	try {
		const { email } = req.body;
		const user = await User.findOne({ email });
		if (!user) return res.status(404).send("User not found");

		const token = crypto.randomBytes(20).toString("hex");
		const tokenExpiry = Date.now() + 3600000; // 1 hour

		user.resetPasswordToken = token;
		user.resetPasswordExpires = tokenExpiry;
		await user.save();

		await sendPasswordResetEmail(user.email, token);

		res.send("Password recovery email sent");
	} catch (err) {
		console.error("Error during password recovery", err);
		res.status(500).send("Error during password recovery");
	}
};

exports.resetPassword = async (req, res) => {
	try {
		const { token, newPassword } = req.body;
		const user = await User.findOne({
			resetPasswordToken: token,
			resetPasswordExpires: { $gt: Date.now() },
		});
		if (!user) return res.status(400).send("Invalid or expired token");

		user.password = newPassword;
		user.resetPasswordToken = undefined;
		user.resetPasswordExpires = undefined;
		await user.save();

		res.send("Password has been reset");
	} catch (err) {
		console.error("Error resetting password", err);
		res.status(500).send("Error resetting password");
	}
};

async function sendPasswordResetEmail(email, token) {
	let transporter = nodemailer.createTransport({
		service: "Gmail",
		auth: {
			user: process.env.EMAIL_USER,
			pass: process.env.EMAIL_PASS,
		},
	});

	let mailOptions = {
		from: process.env.EMAIL_USER,
		to: email,
		subject: "Password Reset",
		text: `You requested a password reset. Please use the following token to reset your password: ${token}\n\nThis token is valid for one hour.`,
	};

	await transporter.sendMail(mailOptions);
}
