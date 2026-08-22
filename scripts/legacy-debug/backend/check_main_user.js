const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;

    // Find user 69f6f02ac5fd956faf343a6d - this seems to be the main user with $6000 history
    const user = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId('69f6f02ac5fd956faf343a6d') });
    console.log('=== USER ===');
    console.log(`Username: ${user?.username}`);
    console.log(`Accounts:`);
    for (const a of (user?.cTraderAccounts || [])) {
        console.log(`  - ${a.cTraderId} | ${a.accountType} | Balance: $${a.balance} | Broker: ${a.broker}`);
    }

    // All positions for this user
    const positions = await db.collection('positions').find({ userId: new mongoose.Types.ObjectId('69f6f02ac5fd956faf343a6d') }).sort({ closeTime: -1 }).toArray();
    console.log(`\n=== ALL POSITIONS (${positions.length}) ===`);
    let totalProfit = 0;
    for (const p of positions) {
        const profit = p.finalProfit || 0;
        totalProfit += profit;
        console.log(`  ${p.status} | ${p.symbol} ${p.side} ${p.volume}lot | Entry: ${p.entryPrice} | Close: ${p.closePrice || '-'} | PnL: $${profit.toFixed(2)} | Account: ${p.accountId} | CloseTime: ${p.closeTime || '-'}`);
    }
    console.log(`\nTotal realized profit: $${totalProfit.toFixed(2)}`);
    console.log(`Expected balance: $${(1000 + totalProfit).toFixed(2)}`);

    await mongoose.disconnect();
}

main().catch(console.error);
