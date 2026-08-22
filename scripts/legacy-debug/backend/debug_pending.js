const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function main() {
    await mongoose.connect(MONGO_URI);
    const Position = mongoose.model('Position', new mongoose.Schema({}, { strict: false }), 'positions');
    
    const pending = await Position.find({ status: 'PENDING' });
    console.log(`\n=== PENDING ORDERS (${pending.length}) ===`);
    for (const p of pending) {
        console.log(`  ID: ${p._id}`);
        console.log(`  Symbol: ${p.symbol} | Side: ${p.side} | OrderType: ${p.orderType}`);
        console.log(`  Entry Price: ${p.entryPrice} | Volume: ${p.volume}`);
        console.log(`  TP: ${p.takeProfit} | SL: ${p.stopLoss}`);
        console.log(`  Status: ${p.status}`);
        console.log('  ---');
    }
    
    await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
