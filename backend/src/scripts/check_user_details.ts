import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Position from '../models/Position';

dotenv.config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("Connected to MongoDB");

    const user = await User.findById('6a342626467cc336112aa9cd');
    if (!user) {
        console.log("User not found!");
        process.exit(0);
    }

    console.log("User found:");
    console.log("ID:", user._id);
    console.log("Username:", user.username);
    console.log("cTraderAccounts:", JSON.stringify(user.cTraderAccounts, null, 2));

    const positions = await Position.find({ userId: user._id });
    console.log(`Total Positions: ${positions.length}`);
    console.log("Open Positions:", positions.filter(p => p.status === 'OPEN').length);
    console.log("Closed Positions:", positions.filter(p => p.status === 'CLOSED').length);
    
    // Print the details of the open positions
    console.log("Open Positions details:", JSON.stringify(positions.filter(p => p.status === 'OPEN'), null, 2));

    await mongoose.disconnect();
}

run().catch(console.error);
