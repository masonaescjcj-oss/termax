const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // 1. Find ALL users and their accounts
    const users = await db.collection('users').find({}).toArray();
    console.log(`\n=== USERS (${users.length}) ===`);
    for (const u of users) {
        console.log(`\nUser: ${u.username} (${u._id})`);
        console.log(`  Accounts: ${(u.cTraderAccounts || []).length}`);
        for (const a of (u.cTraderAccounts || [])) {
            console.log(`    - ${a.cTraderId} | ${a.accountType} | Balance: $${a.balance} | Broker: ${a.broker}`);
        }
    }

    // 2. Count all positions grouped by status
    const positions = await db.collection('positions').find({}).toArray();
    const grouped = {};
    for (const p of positions) {
        const key = `${p.userId}-${p.accountId}-${p.status}`;
        if (!grouped[key]) grouped[key] = { userId: p.userId, accountId: p.accountId, status: p.status, count: 0, totalProfit: 0 };
        grouped[key].count++;
        grouped[key].totalProfit += (p.finalProfit || 0);
    }
    
    console.log(`\n=== POSITIONS SUMMARY (Total: ${positions.length}) ===`);
    for (const [key, g] of Object.entries(grouped)) {
        console.log(`  User: ${g.userId} | Account: ${g.accountId} | Status: ${g.status} | Count: ${g.count} | Total Profit: $${g.totalProfit.toFixed(2)}`);
    }

    // 3. Show recent closed positions (last 10)
    const recentClosed = await db.collection('positions')
        .find({ status: 'CLOSED' })
        .sort({ closeTime: -1 })
        .limit(10)
        .toArray();
    
    console.log(`\n=== LAST 10 CLOSED POSITIONS ===`);
    for (const p of recentClosed) {
        console.log(`  ${p.symbol} ${p.side} ${p.volume}lot | Entry: ${p.entryPrice} | Close: ${p.closePrice} | PnL: $${(p.finalProfit || 0).toFixed(2)} | Closed: ${p.closeTime} | Account: ${p.accountId}`);
    }

    // 4. Show any OPEN positions
    const openPos = await db.collection('positions').find({ status: 'OPEN' }).toArray();
    console.log(`\n=== OPEN POSITIONS (${openPos.length}) ===`);
    for (const p of openPos) {
        console.log(`  ${p.symbol} ${p.side} ${p.volume}lot | Entry: ${p.entryPrice} | Account: ${p.accountId} | User: ${p.userId}`);
    }

    // 5. Check trade history
    const historyCount = await db.collection('tradehistories').countDocuments();
    console.log(`\n=== TRADE HISTORY: ${historyCount} records ===`);

    await mongoose.disconnect();
    console.log('\nDone.');
}

main().catch(console.error);
