import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';

dotenv.config();

async function run() {
    if (!process.env.MONGODB_URI) {
        console.error("MONGODB_URI is not defined in env!");
        process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const users = await User.find({});
    console.log(`Total users in database: ${users.length}`);

    for (const user of users) {
        console.log(`- Username: ${user.username}`);
        console.log(`  ID: ${user._id}`);
        console.log(`  avatarUrl: ${user.avatarUrl}`);
        console.log(`  activeNft: ${user.activeNft}`);
        console.log(`  telegramId: ${user.telegramId}`);
    }

    await mongoose.disconnect();
}

run().catch(console.error);
