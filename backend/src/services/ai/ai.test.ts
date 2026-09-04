/**
 * AI tool layer tests — the pure and stub-able parts: registry integrity,
 * the never-execute proposal tool's engine numbers (hand-computed), indicator
 * values over a seeded candle store, the smalltalk router heuristic, widget
 * sanitisation, and quota limit parsing.
 *
 * Run with:  npx ts-node src/services/ai/ai.test.ts
 */

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://stub.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'stub-key';

import fs from 'fs';
import os from 'os';
import path from 'path';
import { setQuote, __resetQuotes } from '../pricing';
import { __setCandleRoot, appendBars } from '../candles/store';
import { Bar } from '../strategy/types';

/* eslint-disable @typescript-eslint/no-var-requires */
const { AI_TOOLS, executeTool, toolSchemas } = require('./tools') as typeof import('./tools');
const { isSmalltalk, sanitizeWidget } = require('../../controllers/aiController') as typeof import('../../controllers/aiController');
const { dailyLimitFor } = require('./quota') as typeof import('./quota');

let passed = 0;
const failures: string[] = [];
function check(name: string, got: unknown, want: unknown, tolerance = 0) {
    let ok: boolean;
    if (typeof got === 'number' && typeof want === 'number') {
        ok = Number.isFinite(got) && Math.abs(got - want) <= tolerance;
    } else {
        ok = got === want;
    }
    if (ok) passed++;
    else failures.push(`${name}\n      got  ${String(got)}\n      want ${String(want)}`);
}
function section(t: string) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`); }

const MIN = 60_000;

async function main() {
    // ── registry integrity ──────────────────────────────────────────
    section('registry: 15 typed tools, unique, schema-complete');
    {
        const names = AI_TOOLS.map(t => t.name);
        check('fifteen tools', names.length, 15);
        check('names unique', new Set(names).size, names.length);
        check('no execute_order tool exists', names.includes('execute_order'), false);
        check('propose_order exists', names.includes('propose_order'), true);
        const schemas = toolSchemas();
        check('every tool has a schema', schemas.every(s => s.function.name && s.function.description && s.function.parameters), true);
        const expected = ['get_account', 'get_positions', 'get_trade_stats', 'get_quote', 'get_candles', 'get_indicator', 'run_backtest', 'save_strategy', 'deploy_strategy', 'propose_order', 'get_trade_dna', 'explain_trade', 'eval_indicator_expr', 'save_custom_indicator', 'save_code_indicator'];
        check('exactly the documented tool set', expected.every(n => names.includes(n)), true);
    }

    // ── executeTool guardrails ──────────────────────────────────────
    section('executeTool: unknown tools and bad JSON fail closed');
    {
        const unknown = await executeTool('u1', 'drop_database', '{}');
        check('unknown tool -> error', typeof unknown.error, 'string');
        const badJson = await executeTool('u1', 'get_quote', '{not json');
        check('bad JSON args -> error', typeof badJson.error, 'string');
    }

    // ── get_quote ───────────────────────────────────────────────────
    section('get_quote: live book, real spread');
    {
        __resetQuotes();
        setQuote('EUR/USD', 1.1000, 1.1001);
        const q = await executeTool('u1', 'get_quote', JSON.stringify({ symbol: 'EUR/USD' }));
        check('bid', q.bid, 1.1000, 1e-9);
        check('ask', q.ask, 1.1001, 1e-9);
        check('spread 1 pip', q.spreadPips, 1, 1e-6);
        const missing = await executeTool('u1', 'get_quote', JSON.stringify({ symbol: 'XXX/YYY' }));
        check('unpriced symbol -> error, not zero', typeof missing.error, 'string');
    }

    // ── propose_order ───────────────────────────────────────────────
    section('propose_order: engine numbers, never an execution');
    {
        // BUY 0.5 lots EUR/USD at ask 1.1001, SL 1.0951 = 50 pips.
        // Pip value 0.5 lot = $5/pip -> risk $250. TP 1.1101 = 100 pips -> $500.
        const r = await executeTool('u1', 'propose_order', JSON.stringify({
            symbol: 'EUR/USD', side: 'BUY', volume: 0.5,
            stopLoss: 1.0951, takeProfit: 1.1101, rationale: 'test',
        }));
        check('returns a proposal', !!r.proposal, true);
        check('never marked executed', r.proposal.executed, false);
        check('entry is the ask', r.proposal.estimatedEntry, 1.1001, 1e-9);
        check('risk $250', r.proposal.riskMoney, 250, 1e-6);
        check('reward $500', r.proposal.rewardMoney, 500, 1e-6);
        check('R:R 2', r.proposal.rewardRiskRatio, 2, 1e-9);
        check('pip value $5', r.proposal.pipValue, 5, 1e-9);
        check('margin is engine-computed and positive', (r.proposal.marginRequired ?? 0) > 0, true);

        const wrongSl = await executeTool('u1', 'propose_order', JSON.stringify({
            symbol: 'EUR/USD', side: 'BUY', volume: 0.5, stopLoss: 1.2, rationale: 'x',
        }));
        check('SL above ask on a BUY -> refused', typeof wrongSl.error, 'string');
        const tiny = await executeTool('u1', 'propose_order', JSON.stringify({
            symbol: 'EUR/USD', side: 'BUY', volume: 0.001, stopLoss: 1.09, rationale: 'x',
        }));
        check('below-minimum volume -> refused', typeof tiny.error, 'string');
    }

    // ── get_candles + get_indicator over a seeded store ─────────────
    section('candles and indicators come from the store, not the model');
    {
        const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'termax-ai-'));
        __setCandleRoot(ROOT);
        const T0 = Math.floor(Date.now() / MIN) * MIN - 500 * MIN;
        const bars: Bar[] = [];
        for (let i = 0; i < 400; i++) {
            const c = 100 + i; // strictly rising: SMA(3) at bar i = c - 1
            bars.push({ time: T0 + i * MIN, open: c, high: c, low: c, close: c, volume: 1 });
        }
        appendBars('SPX', bars);

        const c = await executeTool('u1', 'get_candles', JSON.stringify({ symbol: 'SPX', timeframe: '1m', limit: 50 }));
        check('50 candles', c.count, 50);
        check('newest close is the last bar', c.bars[49].close, 499, 1e-9);

        const ind = await executeTool('u1', 'get_indicator', JSON.stringify({
            symbol: 'SPX', timeframe: '1m',
            indicator: { type: 'SMA', period: 3 }, count: 5,
        }));
        check('5 indicator values', ind.values.length, 5);
        // Last bar close 499 -> SMA(3) of 497,498,499 = 498.
        check('SMA(3) hand-computed', ind.values[4].value, 498, 1e-9);
        check('each value carries its bar time', typeof ind.values[0].time, 'number');

        const bad = await executeTool('u1', 'get_indicator', JSON.stringify({
            symbol: 'SPX', timeframe: '1m', indicator: { type: 'WISHFUL' }, count: 5,
        }));
        check('unknown indicator type -> error', typeof bad.error, 'string');
        fs.rmSync(ROOT, { recursive: true, force: true });
    }

    // ── spec validation path used by the AI authoring loop ──────────
    section('save_strategy surfaces path-addressed validation errors');
    {
        const r = await executeTool('u1', 'save_strategy', JSON.stringify({
            spec: { name: 'bad', symbol: 'EUR/USD', timeframe: '1m', entry: {}, exit: {}, sizing: { fixedLots: 1 } },
        }));
        check('invalid spec -> errors array', Array.isArray(r.errors), true);
        check('errors carry paths', r.errors.every((e: any) => typeof e.path === 'string' && typeof e.message === 'string'), true);
    }

    // ── smalltalk router ────────────────────────────────────────────
    section('router heuristic: cheap path only for smalltalk');
    {
        check('greeting is smalltalk', isSmalltalk('hi'), true);
        check('persian greeting is smalltalk', isSmalltalk('سلام'), true);
        check('thanks is smalltalk', isSmalltalk('thanks!'), true);
        check('a market question is not', isSmalltalk('what is the EUR/USD price?'), false);
        check('persian market question is not', isSmalltalk('قیمت طلا چنده؟'), false);
        check('anything with digits is not', isSmalltalk('why 42'), false);
        check('long messages are not', isSmalltalk('please take a careful look at my whole account and tell me everything'), false);
    }

    // ── widget sanitisation ─────────────────────────────────────────
    section('legacy confidence numbers are stripped server-side');
    {
        const w = sanitizeWidget({ type: 'signal', data: { symbol: 'X', confidence: 90, score: 85, entry: 1 } });
        check('confidence removed', 'confidence' in w.data, false);
        check('invented score removed', 'score' in w.data, false);
        check('real fields survive', w.data.entry, 1);
        check('null widget passes through', sanitizeWidget(null), null);
    }

    // ── quota limits ────────────────────────────────────────────────
    section('quota: env-driven daily limit');
    {
        // The app is given away — FREE_FOR_ALL defaults on, so a plain user
        // resolves to PRO and gets the PRO allowance, not the old 30. The
        // tiered numbers are still proven in plans.test.ts with the switch
        // off; do not change this back to 30 without turning charging on.
        delete process.env.AI_FREE_DAILY_MSGS;
        check('a plain user gets the unlocked allowance', dailyLimitFor({}), 300);

        // The AI bill is the one cost that giving the app away does not
        // remove, so this cap has to still bite.
        process.env.AI_FREE_DAILY_MSGS = '55';
        check('env override still caps everyone', dailyLimitFor({}), 55);
        check('admin unlimited', dailyLimitFor({ role: 'admin' }) > 1000, true);
        delete process.env.AI_FREE_DAILY_MSGS;
    }

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
