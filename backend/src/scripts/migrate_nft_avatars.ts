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

    // Find all users where avatarUrl starts with 'nft_'
    const users = await User.find({ avatarUrl: /^nft_/ });
    console.log(`Found ${users.length} users with NFT avatarUrls to migrate.`);

    for (const user of users) {
        const nftKey = user.avatarUrl;
        console.log(`Migrating user ${user.username} (${user._id}): moving avatarUrl '${nftKey}' to activeNft`);
        
        user.activeNft = nftKey;
        user.avatarUrl = undefined; // Reset to default pfp

        await user.save();
    }

    console.log("Migration complete!");
    await mongoose.disconnect();
}

run().catch(console.error);
