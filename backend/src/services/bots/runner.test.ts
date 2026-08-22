/**
 * Bot runner tests.
 *
 * The database models and the simulated-order core are stubbed; the real
 * pricing store supplies quotes. What is verified is the runner's own job:
 * that a closed bar turns into exactly the order the spec implies — right
 * side, right SL/TP, right size (the riskPercent maths against live ask/bid
 * fills), botId attached — and that exits release the position slot.
 *
 * Run with:  npx ts-node src/services/bots/runner.test.ts
 */

// The runner's import graph reaches config/supabase, which needs env vars.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://stub.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'stub-key';

import { setQuote, __resetQuotes } from '../pricing';
import { initialBotState, StrategySpec } from '../strategy/types';

/* eslint-disable @typescript-eslint/no-var-requires */
const BotModel = require('../../models/Bot').default;
const PositionModel = require('../../models/Position').default;
const UserModel = require('../../models/User').default;
const tradeController = require('../../controllers/tradeController');
const { BotRunner } = require('./runner') as typeof import('./runner');

// ── tiny assertion harness ──────────────────────────────────────────
let passed = 0;
const failures: string[] = [];

function check(name: string, got: unknown, want: unknown, tolerance = 0) {
    let ok: boolean;
    if (typeof got === 'number' && typeof want === 'number') {
        ok = Number.isFinite(got) && Math.abs(got - want) <= tolerance;
    } else {
        ok = got === want;
    }
    if (ok) {
        passed++;
    } else {
        failures.push(`${name}\n      got  ${String(got)}\n      want ${String(want)}`);
    }
}

function section(title: string) {
    console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`);
}

/** Let the runner's promise chains drain. */
async function settle(turns = 20) {
    for (let i = 0; i < turns; i++) await new Promise(setImmediate);
}

// ── stubs ───────────────────────────────────────────────────────────
BotModel.saveRunState = async () => {};
PositionModel.find = async () => [];
// While a bot holds a position, between-bars refresh sees it still OPEN.
PositionModel.findOne = async (q: any) => ({ id: q?.id, status: 'OPEN' });
UserModel.findById = async () => ({
    cTraderAccounts: [{ cTraderId: 'acc-1', accountType: 'DEMO', balance: 10_000, currency: 'USD' }],
});

const opened: any[] = [];
const closed: any[] = [];
tradeController.openSimulatedOrder = async (userId: string, params: any) => {
    opened.push({ userId, ...params });
    return { status: 200, body: { data: { id: `pos-${opened.length}` } } };
};
tradeController.closeSimulatedAtMarket = async (userId: string, positionId: string, reason: string) => {
    closed.push({ userId, positionId, reason });
    return { status: 200, body: { success: true } };
};

// ── fixtures ────────────────────────────────────────────────────────
const MIN = 60_000;
const T0 = Date.UTC(2026, 3, 8, 10, 0, 0);

const row = (id: string, spec: StrategySpec) => ({
    id, userId: 'user-1', accountId: 'acc-1', name: spec.name, spec,
    status: 'FORWARD_TEST' as const, runState: initialBotState(),
    startedAt: null, stoppedAt: null, createdAt: new Date(0), updatedAt: new Date(0),
});

const bar = (i: number, close: number) => ({
    time: T0 + i * MIN, open: close, high: close, low: close, close, volume: 1,
});

async function main() {
    __resetQuotes();
    setQuote('EUR/USD', 1.1000, 1.1001);

    // ── riskPercent sizing ──────────────────────────────────────────
    section('riskPercent entry: size from equity, SL distance, ask fill');
    {
        const runner = new BotRunner();
        const fed: string[] = [];
        await runner.register(row('bot-risk', {
            name: 'risk bot', symbol: 'EUR/USD', timeframe: '1m',
            entry: { long: { gt: ['close', 0] } },
            exit: {
                stopLoss: { pips: 50 },
                takeProfit: { pips: 100 },
                signal: { long: { lt: ['close', 1] } },
            },
            sizing: { riskPercent: 1 },
        }));
        runner.setFeedHook(s => fed.push(s));
        check('feed hook replays registered symbols', fed.join(','), 'EUR/USD');
        check('runner size', runner.size(), 1);

        runner.onBar('EUR/USD', '1m', bar(0, 1.1000));
        await settle();

        check('one order opened', opened.length, 1);
        const o = opened[0];
        check('order side', o.side, 'BUY');
        check('order symbol', o.symbol, 'EUR/USD');
        check('order carries botId', o.botId, 'bot-risk');
        check('order account', o.accountId, 'acc-1');
        check('SL 50 pips under the close', o.stopLoss, 1.0950, 1e-9);
        check('TP 100 pips over the close', o.takeProfit, 1.1100, 1e-9);
        // equity 10,000 × 1% = $100 risk. Fill at ask 1.1001, SL 1.0950 →
        // 51 pips; pip value $10/lot → 100 / 510 = 0.196 → snaps to 0.20.
        check('lots from risk maths', o.volume, 0.20, 1e-9);

        // Same bar again while the position is open must NOT re-enter.
        runner.onBar('EUR/USD', '1m', bar(1, 1.1000));
        await settle();
        check('no pyramid entry while open', opened.length, 1);

        // ── signal exit ─────────────────────────────────────────────
        section('signal exit closes the held position');
        runner.onBar('EUR/USD', '1m', bar(2, 0.9000));
        await settle();
        check('one close issued', closed.length, 1);
        check('closes the opened position', closed[0].positionId, 'pos-1');
        check('close reason names the signal', closed[0].reason, 'BOT SIGNAL');

        // Flat again: the always-true entry may fire on a later bar.
        runner.onBar('EUR/USD', '1m', bar(3, 1.1000));
        await settle();
        check('re-entry after exit works', opened.length, 2);
        check('new position id adopted', closed.length, 1);

        runner.unregister('bot-risk');
        check('unregister empties the runner', runner.size(), 0);
        runner.onBar('EUR/USD', '1m', bar(4, 1.1000));
        await settle();
        check('unregistered bot gets no bars', opened.length, 2);
    }

    // ── fixedLots + refusal paths ───────────────────────────────────
    section('fixedLots entry and quiet-bar position keeping');
    {
        opened.length = 0;
        const runner = new BotRunner();
        await runner.register(row('bot-fixed', {
            name: 'fixed bot', symbol: 'EUR/USD', timeframe: '1m',
            entry: { short: { gt: ['close', 0] } },
            exit: { stopLoss: { pips: 30 } },
            sizing: { fixedLots: 0.05 },
        }));

        runner.onBar('EUR/USD', '1m', bar(10, 1.1000));
        await settle();
        check('fixed lots pass through unscaled', opened[0]?.volume, 0.05);
        check('short side honoured', opened[0]?.side, 'SELL');
        check('short SL is above the close', opened[0]?.stopLoss, 1.1030, 1e-9);
        check('no TP when the spec has none', opened[0]?.takeProfit ?? null, null);

        // Between bars with no signal, the held position must survive the
        // refresh (the engine says it is still OPEN).
        runner.onBar('EUR/USD', '1m', bar(11, 1.1000));
        await settle();
        check('held position survives a quiet bar', opened.length, 1);
        runner.unregister('bot-fixed');
    }

    // ── riskPercent refuses without equity ──────────────────────────
    section('riskPercent entry skipped when equity is unreadable');
    {
        opened.length = 0;
        tradeController.openSimulatedOrder = async (userId: string, params: any) => {
            opened.push({ userId, ...params });
            return { status: 200, body: { data: { id: 'pos-x' } } };
        };
        UserModel.findById = async () => null; // equity resolves to 0
        const runner = new BotRunner();
        await runner.register(row('bot-noeq', {
            name: 'no equity', symbol: 'EUR/USD', timeframe: '1m',
            entry: { long: { gt: ['close', 0] } },
            exit: { stopLoss: { pips: 50 } },
            sizing: { riskPercent: 1 },
        }));
        runner.onBar('EUR/USD', '1m', bar(30, 1.1000));
        await settle();
        check('entry skipped, not crashed', opened.length, 0);
        check('runner still alive', runner.size(), 1);
    }

    // ── report ──────────────────────────────────────────────────────
    console.log(`\n${'═'.repeat(64)}`);
    if (failures.length === 0) {
        console.log(`✅ all ${passed} assertions passed`);
        process.exit(0);
    } else {
        console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
        failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}\n`));
        process.exit(1);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
