import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../models/User';

const checkUsers = async () => {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trade_app';
    try {
        await mongoose.connect(MONGODB_URI);
        const users = await User.find().sort({ createdAt: -1 });
        console.log('--- USERS IN DB ---');
        users.forEach(u => {
            console.log(`Username: ${u.username}, Role: ${u.role}, TelegramId: ${u.telegramId || 'None'}, CreatedAt: ${u.createdAt?.toISOString()}`);
        });
        console.log(`Total count: ${users.length}`);
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
};

checkUsers();
