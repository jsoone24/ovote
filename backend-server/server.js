const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const csurf = require("csurf");
const http = require("http");
const https = require("https");
const helmet = require("helmet");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const errorHandler = require("./middleware/error-handler");
const connectDB = require("./config/db-config");
const rabbitmqService = require("./services/rabbitmq-service");
dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
app.use(helmet()); // various HTTP headers
app.use(
    cors({
        origin: process.env.FRONTEND_SERVER_URL, // Address of fronted-server
        credentials: true,
    })
);
app.use(errorHandler); //handling errors

// provides protection against Cross-Site Request Forgery (CSRF) attacks by generating and validating CSRF tokens
const csrfProtection = csurf({cookie: true});
app.use(csrfProtection);
app.use(function (req, res, next) {
    res.cookie("XSRF-TOKEN", req.csrfToken(), {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    });
    next();
});

// setup router
const userRoutes = require("./routes/user-routes");
const agendaRoutes = require("./routes/agenda-routes");
const recordRoutes = require("./routes/record-routes");

app.use("/api/users", userRoutes);
app.use("/api/agendas", agendaRoutes);
app.use("/api/records", recordRoutes);
app.get("/api/csrf-token", (req, res) => {
    res.json({csrfToken: req.csrfToken()});
});

// connect to db
connectDB();

// RabbitMQ start
rabbitmqService.processQueue();

// SSL option
const sslOptions = {
    key: fs.readFileSync(path.resolve(__dirname, process.env.SSL_KEY_PATH), {encoding: "utf8",}),
    cert: fs.readFileSync(path.resolve(__dirname, process.env.SSL_CERT_PATH), {encoding: "utf8",}),
};

// Create HTTP server to redirect to HTTPS
const httpApp = express();
httpApp.use((req, res, next) => {
    if (req.secure) {
        return next();
    }
    res.redirect(`https://${req.headers.host}${req.url}`);
});
http.createServer(httpApp).listen(80, () => {
    console.log("HTTP Server running on port 80");
});

// run HTTPS server
https.createServer(sslOptions, app).listen(process.env.EXPRESS_PORT, () => {
    console.log(
        `HTTPS Server is running on https://localhost:${process.env.EXPRESS_PORT}`
    );
});
