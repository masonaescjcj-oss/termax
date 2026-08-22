import mongoose from 'mongoose';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

import User from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'trade_app_jwt_secret_2026_super_secure';

const testApi = async () => {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trade_app';
    try {
        await mongoose.connect(MONGODB_URI);
        const user = await User.findOne({ telegramId: '8608300850' }); // User: iso_dar
        if (!user) {
            console.error('Test user iso_dar not found');
            return;
        }

        console.log(`Generating token for: ${user.username} (ID: ${user._id})`);
        const token = jwt.sign(
            { id: user._id.toString(), username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log('Sending GET request to http://localhost:5000/api/v1/campaigns ...');
        const res = await axios.get('http://localhost:5000/api/v1/campaigns', {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('--- API RESPONSE ---');
        console.log(`Success: ${res.data?.success}`);
        console.log(`Campaigns returned: ${res.data?.campaigns?.length}`);
        if (res.data?.campaigns) {
            res.data.campaigns.forEach((c: any) => {
                console.log(`- Title: ${c.title}, Joined: ${c.joined || false}, CompletedTasks: ${c.completedTasks?.length || 0}`);
            });
        }
    } catch (err: any) {
        console.error('API Error:', err.response?.data || err.message);
    } finally {
        await mongoose.disconnect();
    }
};

testApi();
