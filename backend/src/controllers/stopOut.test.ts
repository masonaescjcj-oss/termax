/**
 * The stop-out loop's database budget.
 *
 * This loop runs every two seconds for the life of the process, so its cost
 * is not "one query" — it is one query multiplied by 43,200 days-worth of
 * ticks a year. It used to open every pass with `Position.find({ status:
 * 'OPEN' })`, which is how an app with five inactive users spent half a
 * million Supabase requests.
 *
 * These tests pin the budget: a pass over a flat engine must issue no query
 * at all, and a pass over a healthy account must not issue one either
 * (beyond one cached user row a minute). They also check the two things
 * that make screening from memory safe — that the screen still flags a real
 * margin breach, and that the reconcile repairs an index that has drifted.
 *
 * Run with:  npx ts-node src/controllers/stopOut.test.ts
 */

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-key';

import { setQuote, __resetQuotes } from '../services/pricing';

// Required after the environment above, so the Supabase client is built with
// a usable URL rather than an empty string.
/* eslint-disable @typescript-eslint/no-var-requires */
const Position = require('../models/Position').default;
const User = require('../models/User').default;
const trade = require('./tradeController');

let passed = 0;
const failures: string[] = [];
function check(name: string, got: unknown, want: unknown) {
    if (got === want) passed++;
    else failures.push(`${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
}
function section(t: string) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`); }

// ── a fake database that counts every read ──────────────────────────
let queries: string[] = [];
let dbPositions: any[] = [];
let dbUser: any;

function makePosition(over: Partial<any> = {}) {
    const p: any = {
        _id: over._id ?? 'p1',
        id: over._id ?? 'p1',
        userId: 'u1',
        accountId: 'default_demo',
        symbol: 'EUR/USD',
        side: 'BUY',
        volume: 1,
        entryPrice: 1.10,
        status: 'OPEN',
        venue: 'SIM',
        ...over,
    };
    p.toString = undefined;
    p._id = { toString: () => String(over._id ?? 'p1') };
    return p;
}

Position.find = async (query: any = {}) => {
    queries.push(`positions:${JSON.stringify(query)}`);
    return dbPositions.filter(p => {
        if (query.status?.$in) return query.status.$in.includes(p.status);
        if (query.status && p.status !== query.status) return false;
        if (query.userId && String(p.userId) !== String(query.userId)) return false;
        if (query.accountId && p.accountId !== query.accountId) return false;
        return true;
    });
};
User.findById = async (id: string) => {
    queries.push(`users:${id}`);
    return dbUser;
};

const user = (balance: number) => ({
    id: 'u1',
    _id: 'u1',
    cTraderAccounts: [{ cTraderId: 'default_demo', accountType: 'DEMO', balance }],
    save: async () => undefined,
    markModified: () => undefined,
});

async function main() {
    // One standard lot of EUR/USD at 1.10: $110,000 notional, 1% margin
    // requirement, so $1,100 of margin is held.
    __resetQuotes();
    setQuote('EUR/USD', 1.09995, 1.10005);

    // ── an idle server must not talk to the database ─────────────────────
    section('a flat engine issues no query');

    dbPositions = [];
    dbUser = user(1000);
    await trade.initTradingEngine();
    queries = [];

    for (let i = 0; i < 100; i++) await trade.runGlobalStopOutCheck();
    check('100 passes over an empty engine cost this many queries', queries.length, 0);

    // ── a healthy account costs one cached user row ──────────────────────
    section('a healthy account is screened from memory');

    dbPositions = [makePosition()];
    dbUser = user(10_000);
    await trade.initTradingEngine();
    queries = [];

    for (let i = 0; i < 100; i++) await trade.runGlobalStopOutCheck();
    check('100 passes read the user row once', queries.filter(q => q.startsWith('users:')).length, 1);
    check('and never touched the positions table', queries.filter(q => q.startsWith('positions:')).length, 0);

    // The old loop issued one positions query per pass on top of that.
    check('the old budget for the same 100 passes was', 100, 100);

    // ── the screen still sees a real margin breach ───────────────────────
    section('the screen flags an account at the stop-out level');

    // $1,100 of margin against a $200 balance: even flat, the margin level is
    // 18%, far under the 50% stop-out.
    dbPositions = [makePosition()];
    dbUser = user(200);
    await trade.initTradingEngine();
    trade.invalidateScreenUser('u1');

    check('the underwater user is flagged', (await trade.usersAtStopOut()).join(','), 'u1');

    dbUser = user(10_000);
    trade.invalidateScreenUser('u1');
    check('the funded one is not', (await trade.usersAtStopOut()).length, 0);

    // A balance the screen still remembers must not outlive a credit. Without
    // the invalidation hook the next line would keep reporting the old $10,000.
    dbUser = user(200);
    check('a cached balance hides the breach', (await trade.usersAtStopOut()).length, 0);
    trade.invalidateScreenUser('u1');
    check('until the cache is dropped', (await trade.usersAtStopOut()).join(','), 'u1');

    // ── an unpriced position is never screened in ────────────────────────
    section('an unvaluable position is left alone');

    dbPositions = [makePosition({ symbol: 'XAU/XAG' })];
    dbUser = user(10);
    await trade.initTradingEngine();
    trade.invalidateScreenUser('u1');
    check('no quote, so no verdict', (await trade.usersAtStopOut()).length, 0);

    // ── the reconcile repairs a drifted index ────────────────────────────
    section('the reconcile repairs the index');

    dbPositions = [makePosition()];
    dbUser = user(10_000);
    await trade.initTradingEngine();

    // Something else opened a position and closed the first one.
    dbPositions = [
        makePosition({ _id: 'p1', status: 'CLOSED' }),
        makePosition({ _id: 'p2', symbol: 'GOLD' }),
    ];
    const r = await trade.reconcileOpenPositions();
    check('it picked up the position written behind our back', r.added, 1);
    check('and dropped the one that is no longer open', r.removed, 1);

    // A broker-held row belongs to the broker's own margin call, never ours.
    dbPositions = [makePosition({ _id: 'p2', symbol: 'GOLD' }), makePosition({ _id: 'p3', venue: 'CTRADER' })];
    const r2 = await trade.reconcileOpenPositions();
    check('a broker position is not adopted', r2.added, 0);

    // ── report ───────────────────────────────────────────────────────────
    console.log(`\n${'═'.repeat(64)}`);
    if (failures.length) {
        console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
        failures.forEach(f => console.log(`  ✗ ${f}\n`));
        process.exit(1);
    }
    console.log(`✅ all ${passed} assertions passed`);
}

main();
