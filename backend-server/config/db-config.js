const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('MongoDB connected...');
        await initializeData();
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const initializeData = async () => {
    const User = require('../models/user-model');

    // Check if data already exists
    const count = await User.countDocuments().exec();
    if (count === 0) {
        // Define initial data
        const initialData = [
            {
                name: 'Admin User',
                email: 'admin@example.test',
                password: process.env.SEED_USER_PASSWORD || 'change-me-dev-only',
                organization: 'org1',
                role: 'admin',
                votedAgendas: []
            },
            {
                name: 'Demo User',
                email: 'user@example.test',
                password: process.env.SEED_USER_PASSWORD || 'change-me-dev-only',
                organization: 'org1',
                role: 'user',
                votedAgendas: []
            },
        ];

        // Save each user individually to trigger pre-save hook
        for (let userData of initialData) {
            const newUser = new User(userData);
            await newUser.save();
        }

        console.log('Initial data inserted');
    } else {
        console.log('Data already exists');
    }
}


module.exports = connectDB;