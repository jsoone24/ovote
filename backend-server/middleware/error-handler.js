const errorHandler = (err, req, res, next) => {
	if (err.code !== "EBADCSRFTOKEN") return next(err);
	console.error(err.stack);
	res.status(500).send({ error: err.message });
};

module.exports = errorHandler;
