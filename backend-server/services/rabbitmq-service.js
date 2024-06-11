const amqp = require("amqplib");
const dotenv = require("dotenv");
const crypto = require("crypto");
const Agenda = require("../models/agenda-model");
const Record = require("../models/record-model");
const fabricGateway = require("./fabric-gateway-service");

dotenv.config();

function generateHash(org, agendaId, salt) {
	return crypto
		.createHash("sha256")
		.update(org + agendaId + salt)
		.digest("hex");
}

class RabbitmqService {
	constructor() {
		this.channel = null;
		this.init();
	}

	async init() {
		try {
			const connection = await amqp.connect(process.env.RABBITMQ_URL);
			this.channel = await connection.createChannel();
			await this.channel.assertQueue(process.env.QUEUE_NAME, {
				durable: true,
			});
			console.log("Connected to RabbitMQ");
		} catch (error) {
			console.error("Failed to connect to RabbitMQ", error);
		}
	}

	async sendMessage(message) {
		if (!this.channel) {
			await this.init(); // Ensure the channel is initialized
		}
		try {
			const buffer = Buffer.from(JSON.stringify(message));
			this.channel.sendToQueue(process.env.QUEUE_NAME, buffer, {
				persistent: true,
			});
			console.log("Message sent to queue:", message);
		} catch (error) {
			console.error("Failed to send message to queue", error);
		}
	}

	async processQueue() {
		if (!this.channel) {
			await this.init(); // Ensure the channel is initialized
		}
		this.channel.consume(process.env.QUEUE_NAME, async (msg) => {
			if (msg !== null) {
				try {
					console.log(
						"Received message from queue:",
						msg.content.toString()
					);
					const voteData = JSON.parse(msg.content.toString());
					const { organization, agendaId, selectedOption } = voteData;

					const salt = crypto.randomBytes(16).toString("hex");
					const organizationHash = generateHash(
						organization,
						agendaId,
						salt
					);

					const newRecord = new Record({
						agendaId,
						organizationHash,
						selectedOption,
						salt,
					});
					const savedRecord = await newRecord.save();

					await Agenda.updateOne(
						{
							_id: savedRecord.agendaId,
							"options.option": savedRecord.selectedOption,
						},
						{ $inc: { "options.$.votes": 1 } }
					);
					await Agenda.updateOne(
						{ _id: savedRecord.agendaId },
						{ $set: { lastRecordTime: savedRecord.createdAt } }
					);

					// Serialize MongoDB ObjectId (_id) and createdAt to strings
					const recordForBlockchain = {
						...savedRecord.toObject(),
						_id: savedRecord._id.toString(),
						createdAt: savedRecord.createdAt.toISOString(),
					};

					await fabricGateway.submitToBlockchain(
						JSON.stringify(recordForBlockchain)
					);
					console.log(
						"Processed vote and saved to blockchain:",
						recordForBlockchain
					);

					this.channel.ack(msg);
					console.log("Processed vote and acknowledged the message");
				} catch (error) {
					console.error("Error processing vote", error);
					this.channel.nack(msg, false, false);
				}
			}
		});
	}
}

module.exports = new RabbitmqService();
