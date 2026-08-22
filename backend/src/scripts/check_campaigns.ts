import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Campaign from '../models/Campaign';

const check = async () => {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trade_app';
    try {
        await mongoose.connect(MONGODB_URI);
        const campaigns = await Campaign.find();
        console.log('--- CAMPAIGNS IN DB ---');
        campaigns.forEach(c => {
            console.log(`- Title: ${c.title}, Lottie: ${c.rewardLottieKey}, Tasks: ${c.tasks.length}`);
        });
        console.log(`Total count: ${campaigns.length}`);
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
};

check();
