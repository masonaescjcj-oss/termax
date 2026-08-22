import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Campaign from '../models/Campaign';

const check = async () => {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trade_app';
    console.log('Connecting to:', MONGODB_URI.replace(/:[^:]*@/, ':***@'));
    try {
        await mongoose.connect(MONGODB_URI);
        const campaigns = await Campaign.find().sort({ createdAt: 1 });
        console.log('--- CAMPAIGNS IN DB ---');
        campaigns.forEach(c => {
            console.log(`ID: ${c._id}, Title: ${c.title}, CreatedAt: ${c.createdAt?.toISOString()}`);
        });
        console.log(`Total count: ${campaigns.length}`);
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
};

check();
