const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const auth = (req, res, next) => {
	const token = req.header("Authorization").replace("Bearer ", "");
	if (!token)
		return res.status(401).send("Access denied. No token provided.");

	try {
		req.user = jwt.verify(token, process.env.JWT_SECRET);
		next();
	} catch (ex) {
		res.status(400).send("Invalid token.");
	}
};

module.exports = auth;
