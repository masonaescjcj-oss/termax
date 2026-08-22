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
                title: 'چالش معامله‌گر طلایی (Golden Trader)',
                description: 'با ثبت ۵ برد متوالی در معاملات طلا و جفت‌ارزها، نشان شجاعت و آواتار متحرک قلب را دریافت کنید.',
                rewardLottieKey: 'nft_heart',
                accentColor: '#F59E0B',
                maxParticipants: 50,
                isActive: true,
                tasks: [
                    {
                        taskId: 'task_gold_broker',
                        title: 'اتصال حساب معاملاتی برای ترید طلا',
                        description: 'یک حساب دمو یا واقعی متصل کنید تا تریدهای شما ثبت شوند.',
                        taskType: 'CONNECT_BROKER',
                        config: {}
                    },
                    {
                        taskId: 'task_gold_streak',
                        title: 'رشته برد ۵ تایی در معاملات',
                        description: '۵ معامله متوالی سودده ثبت کنید تا پایداری خود را اثبات کنید.',
                        taskType: 'WIN_STREAK',
                        config: { minStreak: 5 }
                    },
                    {
                        taskId: 'task_gold_link',
                        title: 'عضویت در آکادمی ترید فیروزه‌ای',
                        description: 'از کانال آموزشی ما دیدن کنید و نکات تحلیل طلا را بخوانید.',
                        taskType: 'VISIT_LINK',
                        config: { url: 'https://t.me/trade_app_education' }
                    }
                ]
            },
            {
                title: 'چالش رشد کهکشانی (Galactic Growth)',
                description: 'موجودی حساب دمو خود را ۳ برابر کنید و یکی از تریدرهای برتری باشید که آواتار متحرک جشن را از آن خود می‌کنند.',
                rewardLottieKey: 'nft_party',
                accentColor: '#10B981',
                maxParticipants: 100,
                isActive: true,
                tasks: [
                    {
                        taskId: 'task_galaxy_multiply',
                        title: 'رشد ۳ برابری موجودی حساب دمو',
                        description: 'موجودی اولیه ۱,۰۰۰ دلاری دمو خود را به ۳,۰۰۰ دلار برسانید.',
                        taskType: 'BALANCE_MULTIPLY',
                        config: { multiplier: 3, initialBalance: 1000 }
                    },
                    {
                        taskId: 'task_galaxy_refer',
                        title: 'دعوت از ۳ هم‌تیمی معاملاتی',
                        description: '۳ نفر از دوستان خود را دعوت کنید تا آن‌ها هم در چالش شرکت کنند.',
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
