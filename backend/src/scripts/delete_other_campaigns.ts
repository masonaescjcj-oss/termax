import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Campaign from '../models/Campaign';
import CampaignProgress from '../models/CampaignProgress';

const cleanup = async () => {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trade_app';
    try {
        await mongoose.connect(MONGODB_URI);
        
        const validTitles = ['Genesis Rocket NFT', 'Social Star NFT', 'Streak Flame NFT'];
        
        // Find campaigns to delete
        const toDelete = await Campaign.find({ title: { $nin: validTitles } });
        console.log(`Found ${toDelete.length} campaigns to delete.`);
        
        for (const camp of toDelete) {
            // Delete progress for these campaigns too
            await CampaignProgress.deleteMany({ campaignId: camp._id });
            await Campaign.deleteOne({ _id: camp._id });
            console.log(`Deleted campaign: ${camp.title} and its progress records.`);
        }
        
        console.log('Database cleanup complete. Current campaigns in DB:');
        const remaining = await Campaign.find({});
        remaining.forEach(c => {
            console.log(`- ${c.title} (${c.rewardLottieKey})`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
};

cleanup();
