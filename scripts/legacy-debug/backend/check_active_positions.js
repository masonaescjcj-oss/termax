const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
const USER_ID = "69f6f02ac5fd956faf343a6d";

async function main() {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;
    const positionsCol = db.collection('positions');

    const openPositions = await positionsCol.find({ userId: new mongoose.Types.ObjectId(USER_ID), status: 'OPEN' }).toArray();
    console.log(`\n=== User Open Positions (${openPositions.length}) ===`);
    openPositions.forEach(p => {
        console.log({
            _id: p._id.toString(),
            symbol: p.symbol,
            side: p.side,
            volume: p.volume,
            entryPrice: p.entryPrice,
            accountId: p.accountId,
            openTime: p.openTime,
            status: p.status
        });
    });

    await mongoose.disconnect();
}

main().catch(console.error);
