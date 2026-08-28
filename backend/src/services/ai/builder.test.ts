/**
 * Phase-6 tests: the deterministic rule renderer and the authoring loop
 * (fake model, real validator, stubbed backtest).
 *
 * Run with:  npx ts-node src/services/ai/builder.test.ts
 */

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://stub.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'stub-key';

import { describeSpec, describeCondition, indicatorLabel } from '../strategy/describe';
import { StrategySpec } from '../strategy/types';

/* eslint-disable @typescript-eslint/no-var-requires */
const { buildBotFromDescription, extractJson } = require('./botBuilder') as typeof import('./botBuilder');

let passed = 0;
const failures: string[] = [];
function check(name: string, got: unknown, want: unknown) {
    if (got === want) passed++;
    else failures.push(`${name}\n      got  ${String(got)}\n      want ${String(want)}`);
}
function has(name: string, hay: string | string[], needle: string) {
    const s = Array.isArray(hay) ? hay.join('\n') : hay;
    check(name, s.includes(needle), true);
}
function section(t: string) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`); }

const SPEC: StrategySpec = {
    name: 'RSI برگشتی',
    symbol: 'EUR/USD',
    timeframe: '15m',
    indicators: {
        rsi: { type: 'RSI', period: 14 },
        trend: { type: 'EMA', period: 200, timeframe: '4h' },
    },
    filters: [{ session: 'london' }, { maxSpreadPips: 2 }],
    entry: {
        long: { all: [{ crossesAbove: ['rsi', 30] }, { gt: ['close', 'trend'] }] },
    },
    exit: {
        stopLoss: { atrMultiple: 1.5 },
        takeProfit: { rMultiple: 2 },
        timeStop: { bars: 48 },
    },
    sizing: { riskPercent: 1 },
    limits: { maxTradesPerDay: 3, cooldownBars: 4 },
};

async function main() {
    // ── deterministic renderer ──────────────────────────────────────
    section('describeSpec: the Persian rule sheet says what the engine does');
    {
        const fa = describeSpec(SPEC, 'fa');
        has('symbol + timeframe', fa, 'نماد EUR/USD، تایم‌فریم 15m');
        has('decision on closed bars', fa, 'کندل بسته‌شده');
        has('long entry sentence', fa, 'ورود خرید وقتی: RSI(14) از 30 رو به بالا عبور کند و قیمت پایانی بالاتر از EMA(200) @4h باشد.');
        has('ATR stop', fa, 'حد ضرر: 1.5 برابر ATR(14)');
        has('R-multiple target', fa, 'حد سود: 2 برابر ریسک (R).');
        has('time stop', fa, 'خروج زمانی: بعد از 48 کندل');
        has('risk sizing', fa, 'حجم: 1٪ ریسک از موجودی');
        has('london session filter', fa, 'فقط در سشن لندن');
        has('spread filter', fa, 'اسپرد حداکثر 2 پیپ');
        has('daily cap', fa, 'حداکثر 3 معامله در روز');
        has('cooldown', fa, 'بعد از هر خروج 4 کندل');
        has('single position rule', fa, 'حداکثر یک پوزیشن باز');

        const en = describeSpec(SPEC, 'en');
        has('english long entry', en, 'Go LONG when: RSI(14) crosses above 30 AND the close is above EMA(200) @4h.');
        has('english stop', en, 'Stop loss: 1.5x ATR(14) from entry.');

        check('condition renderer handles any/not',
            describeCondition({ any: [{ lt: ['rsi', 30] }, { not: { gt: ['close', 'trend'] } }] } as any, SPEC, 'en'),
            '(RSI(14) is below 30 OR NOT the close is above EMA(200) @4h)');
        check('MACD label', indicatorLabel({ type: 'MACD', fast: 12, slow: 26, signal: 9 }), 'MACD(12,26,9)');
        check('BBANDS label', indicatorLabel({ type: 'BBANDS', period: 20, mult: 2 }), 'Bollinger(20,2)');
    }

    // ── JSON extraction ─────────────────────────────────────────────
    section('extractJson: fences, prose, and garbage');
    {
        check('bare object', extractJson('{"a":1}')?.a, 1);
        check('fenced object', extractJson('Sure!\n```json\n{"a":2}\n```\nDone.')?.a, 2);
        check('prose around braces', extractJson('here it is: {"a":3} hope it helps')?.a, 3);
        check('no JSON -> null', extractJson('I cannot do that.'), null);
        check('broken JSON -> null', extractJson('{"a": <oops>}'), null);
    }

    // ── the authoring loop ──────────────────────────────────────────
    section('builder loop: validator drives retries, backtest runs once');
    {
        const goodSpec = {
            name: 'ema cross', symbol: 'EUR/USD', timeframe: '1h',
            indicators: { fast: { type: 'EMA', period: 12 }, slow: { type: 'EMA', period: 26 } },
            entry: { long: { crossesAbove: ['fast', 'slow'] } },
            exit: { stopLoss: { pips: 30 } },
            sizing: { riskPercent: 1 },
        };
        const replies = [
            'Sure, here is a strategy for you! (no json at all)',
            JSON.stringify({ ...goodSpec, exit: {} }),          // missing stopLoss
            '```json\n' + JSON.stringify(goodSpec) + '\n```',   // clean, fenced
        ];
        let completeCalls = 0;
        const backtested: any[] = [];
        const sawErrorFeedback: string[] = [];

        const result = await buildBotFromDescription('u1', 'یک استراتژی کراس EMA بساز', {
            days: 30,
            deps: {
                complete: async (messages: any[]) => {
                    completeCalls++;
                    const lastUser = [...messages].reverse().find(m => m.role === 'user');
                    if (lastUser.content.startsWith('VALIDATION ERRORS')) sawErrorFeedback.push(lastUser.content);
                    return replies[completeCalls - 1];
                },
                backtest: async (_u: string, spec: any, days: number) => {
                    backtested.push({ spec, days });
                    return { grade: 'B', netProfit: 123, trades: 40 };
                },
            },
        });

        check('succeeds on the third attempt', result.ok, true);
        check('attempts counted', result.attempts, 3);
        check('model was called three times', completeCalls, 3);
        check('two rounds of error feedback', sawErrorFeedback.length, 2);
        check('stopLoss error was fed back verbatim-pathed', sawErrorFeedback[1].includes('stopLoss'), true);
        check('backtest ran exactly once', backtested.length, 1);
        check('backtest got the CLEAN spec', backtested[0].spec.exit.stopLoss.pips, 30);
        check('backtest window honoured', backtested[0].days, 30);
        check('grade rides along', result.backtest.grade, 'B');
        check('english rules rendered', result.rules!.en.some(l => l.includes('Go LONG')), true);
    }

    // ── the loop gives up honestly ──────────────────────────────────
    section('builder loop: three bad attempts fail with the errors');
    {
        let calls = 0;
        const result = await buildBotFromDescription('u1', 'something impossible', {
            deps: {
                complete: async () => { calls++; return '{"name":"x"}'; },
                backtest: async () => { throw new Error('must not run'); },
            },
        });
        check('fails after max attempts', result.ok, false);
        check('three attempts made', result.attempts, 3);
        check('model called three times', calls, 3);
        check('errors are path-addressed', Array.isArray(result.errors) && result.errors!.every((e: any) => 'path' in e && 'message' in e), true);
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
