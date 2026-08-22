import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Campaign from '../models/Campaign';
import CampaignProgress from '../models/CampaignProgress';

const clean = async () => {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trade_app';
    try {
        await mongoose.connect(MONGODB_URI);
        
        // Delete all campaigns and their progress logs to reset
        await Campaign.deleteMany({});
        await CampaignProgress.deleteMany({});
        
        console.log('Successfully cleared all Campaign and CampaignProgress documents.');
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
};

clean();
