import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Campaign from '../models/Campaign';

const createRandomCampaigns = async () => {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trade_app';
    try {
        await mongoose.connect(MONGODB_URI);
        
        const randomCampaigns = [
            {
                title: 'Golden Trader challenge',
                description: 'Demo campaign content',
                rewardLottieKey: 'nft_heart',
                accentColor: '#F59E0B',
                maxParticipants: 50,
                isActive: true,
                tasks: [
                    {
                        taskId: 'task_gold_broker',
                        title: 'Connect a trading account for gold',
                        description: 'Demo campaign content',
                        taskType: 'CONNECT_BROKER',
                        config: {}
                    },
                    {
                        taskId: 'task_gold_streak',
                        title: 'Demo campaign content',
                        description: 'Demo campaign content',
                        taskType: 'WIN_STREAK',
                        config: { minStreak: 5 }
                    },
                    {
                        taskId: 'task_gold_link',
                        title: 'Demo campaign content',
                        description: 'Demo campaign content',
                        taskType: 'VISIT_LINK',
                        config: { url: 'https://t.me/trade_app_education' }
                    }
                ]
            },
            {
                title: 'Demo campaign content',
                description: 'Demo campaign content',
                rewardLottieKey: 'nft_party',
                accentColor: '#10B981',
                maxParticipants: 100,
                isActive: true,
                tasks: [
                    {
                        taskId: 'task_galaxy_multiply',
                        title: 'Demo campaign content',
                        description: 'Demo campaign content',
                        taskType: 'BALANCE_MULTIPLY',
                        config: { multiplier: 3, initialBalance: 1000 }
                    },
                    {
                        taskId: 'task_galaxy_refer',
                        title: 'Demo campaign content',
                        description: 'Demo campaign content',
                        taskType: 'REFERRAL',
                        config: { minReferrals: 3 }
                    }
                ]
            }
        ];

        for (const camp of randomCampaigns) {
            const exists = await Campaign.findOne({ title: camp.title });
            if (!exists) {
                await Campaign.create(camp);
                console.log(`Successfully created random campaign: ${camp.title}`);
            } else {
                console.log(`Campaign already exists: ${camp.title}`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
};

createRandomCampaigns();
