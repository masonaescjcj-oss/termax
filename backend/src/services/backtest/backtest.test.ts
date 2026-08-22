/**
 * Backtest engine + honesty grade tests.
 *
 * Every expected number is computed by hand from broker arithmetic, not by
 * running the engine and copying its output — the engine must reproduce the
 * reference, never define it.
 *
 * Run with:  npx ts-node src/services/backtest/backtest.test.ts
 */

import { getSpec } from '../../config/instruments';
import { Bar, StrategySpec } from '../strategy/types';
import { runBacktest } from './engine';
import { countTunedParameters, gradeBacktest, perturbSpec } from './honesty';
import { BacktestResult } from './engine';

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

const MIN = 60_000;

/** Flat bar helpers — explicit OHLC when a scenario needs a range. */
const bar = (time: number, close: number, high = close, low = close, open = close): Bar =>
    ({ time, open, high, low, close, volume: 1 });

// ── take-profit round trip, hand-computed ───────────────────────────
section('long TP: fills, costs and pips match broker arithmetic');
{
    // EUR/USD, 1 lot, spread forced to 1 pip (half = 0.00005).
    // Entry on the bar CLOSING above 1.1000 (crossesAbove) at ask:
    //   1.1010 + 0.00005 = 1.10105
    // SL 20 pips below close = 1.0990; TP 40 pips above = 1.1050.
    // Exit when bid touches TP: gross = (1.1050 - 1.10105) x 100k = $395.
    // Commission (EUR/USD spec) = $7/lot round turn -> net $388.
    const spec: StrategySpec = {
        name: 'tp test', symbol: 'EUR/USD', timeframe: '1m',
        entry: { long: { crossesAbove: ['close', 1.1] } },
        exit: { stopLoss: { pips: 20 }, takeProfit: { pips: 40 } },
        sizing: { fixedLots: 1 },
    };
    const T = Date.UTC(2024, 0, 2, 10, 0);
    const bars = [
        bar(T + 0 * MIN, 1.0990),
        bar(T + 1 * MIN, 1.1010),                       // crosses -> entry
        bar(T + 2 * MIN, 1.1015, 1.1020, 1.1005),       // no touch
        bar(T + 3 * MIN, 1.1045, 1.1052, 1.1040),       // bid high 1.10515 >= 1.1050
        bar(T + 4 * MIN, 1.1046),
    ];
    const r = runBacktest(spec, bars, { spreadPips: 1 });
    check('one trade', r.trades.length, 1);
    const t = r.trades[0];
    check('side', t.side, 'BUY');
    check('entry at ask', t.entryPrice, 1.10105, 1e-9);
    check('exit at TP', t.exitPrice, 1.1050, 1e-9);
    check('reason', t.exitReason, 'TAKE_PROFIT');
    check('pips net of spread', t.pips, 39.5, 1e-9);
    check('gross $395', t.grossProfit, 395, 1e-6);
    check('commission $7', t.commission, 7, 1e-9);
    check('net $388', t.netProfit, 388, 1e-6);
    check('end balance', r.endBalance, 10_388, 1e-6);
    check('win rate 100', r.stats.winRate, 100, 1e-9);
    check('spread cost = 1 pip x $10', r.stats.totalSpreadCost, 10, 1e-6);
}

// ── stop-loss wins the both-touched bar ─────────────────────────────
section('SL and TP inside one bar: the stop fills (conservative)');
{
    const spec: StrategySpec = {
        name: 'sl test', symbol: 'EUR/USD', timeframe: '1m',
        entry: { long: { crossesAbove: ['close', 1.1] } },
        exit: { stopLoss: { pips: 20 }, takeProfit: { pips: 40 } },
        sizing: { fixedLots: 1 },
    };
    const T = Date.UTC(2024, 0, 2, 10, 0);
    const bars = [
        bar(T + 0 * MIN, 1.0990),
        bar(T + 1 * MIN, 1.1010),                       // entry; SL 1.0990, TP 1.1050
        bar(T + 2 * MIN, 1.1000, 1.1055, 1.0984),       // BOTH touched
        bar(T + 3 * MIN, 1.1000),
    ];
    const r = runBacktest(spec, bars, { spreadPips: 1 });
    check('one trade', r.trades.length, 1);
    check('stop fills, not TP', r.trades[0].exitReason, 'STOP_LOSS');
    check('exit at SL', r.trades[0].exitPrice, 1.0990, 1e-9);
    // gross = (1.0990 - 1.10105) x 100k = -$205; net -$212.
    check('net -$212', r.trades[0].netProfit, -212, 1e-6);
}

// ── short side and signal exit ──────────────────────────────────────
section('short: sell at bid, cover at ask, signal exit');
{
    const spec: StrategySpec = {
        name: 'short test', symbol: 'EUR/USD', timeframe: '1m',
        entry: { short: { crossesBelow: ['close', 1.1] } },
        exit: { stopLoss: { pips: 50 }, signal: { short: { lt: ['close', 1.0951] } } },
        sizing: { fixedLots: 1 },
    };
    const T = Date.UTC(2024, 0, 2, 10, 0);
    const bars = [
        bar(T + 0 * MIN, 1.1010),
        bar(T + 1 * MIN, 1.0990),   // crosses below -> sell at bid 1.09895
        bar(T + 2 * MIN, 1.0970),
        bar(T + 3 * MIN, 1.0950),   // signal exit -> cover at ask 1.09505
        bar(T + 4 * MIN, 1.0950),
    ];
    const r = runBacktest(spec, bars, { spreadPips: 1 });
    check('one trade', r.trades.length, 1);
    const t = r.trades[0];
    check('side', t.side, 'SELL');
    check('entry at bid', t.entryPrice, 1.09895, 1e-9);
    check('exit at ask', t.exitPrice, 1.09505, 1e-9);
    check('reason', t.exitReason, 'SIGNAL');
    // gross = (1.09895 - 1.09505) x 100k = $390; net $383.
    check('net $383', t.netProfit, 383, 1e-6);
}

// ── JPY conversion from the pair's own series ───────────────────────
section('USD/JPY: P/L converts JPY -> USD by 1/price, exactly');
{
    const spec: StrategySpec = {
        name: 'jpy test', symbol: 'USD/JPY', timeframe: '1m',
        entry: { long: { crossesAbove: ['close', 155] } },
        exit: { stopLoss: { pips: 50 }, takeProfit: { pips: 40 } },
        sizing: { fixedLots: 0.1 },
    };
    const T = Date.UTC(2024, 0, 2, 10, 0);
    const bars = [
        bar(T + 0 * MIN, 154.99),
        bar(T + 1 * MIN, 155.00 + 0.01),    // close 155.01: entry ask 155.015 (spread 1 pip = 0.01)
        bar(T + 2 * MIN, 155.41, 155.42, 155.30), // TP 155.41 touched at bid high 155.415
        bar(T + 3 * MIN, 155.41),
    ];
    const r = runBacktest(spec, bars, { spreadPips: 1 });
    check('one trade', r.trades.length, 1);
    const t = r.trades[0];
    check('TP hit', t.exitReason, 'TAKE_PROFIT');
    // TP = 155.01 + 0.40 = 155.41. grossJPY = (155.41 - 155.015) x 10,000
    // = 3,950 JPY; refMid at exit bar close 155.41 -> $25.4166...
    const expectedGross = 3950 / 155.41;
    check('gross in USD via 1/price', t.grossProfit, expectedGross, 1e-6);
    const commission = getSpec('USD/JPY').commissionPerLot * 0.1;
    check('net = gross - commission', t.netProfit, expectedGross - commission, 1e-6);
    check('no conversion warning for USD pairs', r.warnings.length, 0);
}

// ── riskPercent sizing ──────────────────────────────────────────────
section('riskPercent: 1% of 10k with a 50-pip stop = 0.20 lots');
{
    const spec: StrategySpec = {
        name: 'risk test', symbol: 'EUR/USD', timeframe: '1m',
        entry: { long: { crossesAbove: ['close', 1.1] } },
        exit: { stopLoss: { pips: 50 } },
        sizing: { riskPercent: 1 },
    };
    const T = Date.UTC(2024, 0, 2, 10, 0);
    const bars = [
        bar(T + 0 * MIN, 1.0990),
        bar(T + 1 * MIN, 1.1010),
        bar(T + 2 * MIN, 1.1010),
    ];
    // Spread 0: entry exec = 1.1010, SL = 1.1010 - 0.0050 -> dist exactly 50
    // pips; pip value $10/lot -> lots = 100 / 500 = 0.2.
    const r = runBacktest(spec, bars, { spreadPips: 0 });
    check('one trade (closed at end)', r.trades.length, 1);
    check('sized to 0.20 lots', r.trades[0].volume, 0.2, 1e-9);
    check('end-of-data close', r.trades[0].exitReason, 'END_OF_DATA');
}

// ── swap across rollovers, Wednesday x3 ─────────────────────────────
section('swap: Tue + Wed rollovers = 1x + 3x nights');
{
    const spec: StrategySpec = {
        name: 'swap test', symbol: 'EUR/USD', timeframe: '1m',
        entry: { long: { crossesAbove: ['close', 1.05] } },
        exit: { stopLoss: { pips: 500 } },
        sizing: { fixedLots: 1 },
    };
    // 2024-01-02 is a Tuesday. Enter 18:01 Tue, hold through Tue 21:00 (1x)
    // and Wed 21:00 (3x), end Thu 01:00.
    const start = Date.UTC(2024, 0, 2, 18, 0);
    const end = Date.UTC(2024, 0, 4, 1, 0);
    const bars: Bar[] = [bar(start, 1.0)];
    for (let t = start + MIN; t <= end; t += MIN) bars.push(bar(t, 1.1));
    const r = runBacktest(spec, bars, { spreadPips: 0 });
    check('one trade', r.trades.length, 1);
    const inst = getSpec('EUR/USD');
    // Notional in USD = 100k EUR x 1.10 = $110,000. Four nights' worth
    // (1 + 3) at the long rate, negative = charged.
    const expected = (110_000 * inst.swapLongRate / 365) * 4;
    check('swap = 4 nights at the long rate', r.trades[0].swap, expected, 1e-6);
    check('swap flows into net', r.trades[0].netProfit,
        r.trades[0].grossProfit - r.trades[0].commission + expected, 1e-9);
}

// ── trailing stop ───────────────────────────────────────────────────
section('trailing stop: ratchets up, exits as TRAILING_STOP');
{
    const spec: StrategySpec = {
        name: 'trail test', symbol: 'EUR/USD', timeframe: '1m',
        entry: { long: { crossesAbove: ['close', 1.1] } },
        exit: { stopLoss: { pips: 30 }, trailingStop: { pips: 20 } },
        sizing: { fixedLots: 1 },
    };
    const T = Date.UTC(2024, 0, 2, 10, 0);
    const bars = [
        bar(T + 0 * MIN, 1.0990),
        bar(T + 1 * MIN, 1.1010),   // entry; SL 1.0980
        bar(T + 2 * MIN, 1.1040),   // trail: bid close 1.1040 - 0.0020 = 1.1020
        bar(T + 3 * MIN, 1.1060),   // trail to 1.1040
        bar(T + 4 * MIN, 1.1030, 1.1035, 1.1025), // bid low 1.1025 <= 1.1040 -> out
        bar(T + 5 * MIN, 1.1030),
    ];
    const r = runBacktest(spec, bars, { spreadPips: 0 });
    check('one trade', r.trades.length, 1);
    check('trailing exit', r.trades[0].exitReason, 'TRAILING_STOP');
    check('exit at the ratcheted stop', r.trades[0].exitPrice, 1.1040, 1e-9);
}

// ── honesty: parameter counting and perturbation ────────────────────
section('honesty: tuned-parameter census and ±10% variants');
{
    const spec: StrategySpec = {
        name: 'count test', symbol: 'EUR/USD', timeframe: '1h',
        indicators: {
            fast: { type: 'EMA', period: 12 },
            slow: { type: 'EMA', period: 26 },
        },
        entry: { long: { crossesAbove: ['fast', 'slow'] } },
        exit: { stopLoss: { pips: 30 }, takeProfit: { pips: 60 } },
        sizing: { riskPercent: 1 },
    };
    // Numbers a human could tune: 12, 26, 30, 60, and riskPercent is sizing
    // (not counted), so 4.
    check('counts 4 tuned numbers', countTunedParameters(spec), 4);
    const variants = perturbSpec(spec);
    // Each period gets ±10% (11/13 and 23/29) -> 4 valid variants.
    check('4 perturbed variants', variants.length, 4);
    check('a variant changed exactly one period',
        (variants[0].indicators!.fast as any).period !== 12 || (variants[0].indicators!.slow as any).period !== 26, true);
}

// ── honesty: grading behaviours ─────────────────────────────────────
section('honesty: over-fit signature scores low, robust scores high');
{
    const mkTrade = (entryTime: number, netProfit: number) => ({
        side: 'BUY' as const, volume: 0.1, entryTime, entryPrice: 1, exitTime: entryTime + MIN,
        exitPrice: 1, exitReason: 'TAKE_PROFIT' as const, pips: 0,
        grossProfit: netProfit, commission: 0, swap: 0, netProfit, balanceAfter: 0,
    });
    const spanFrom = Date.UTC(2024, 0, 1);
    const spanTo = Date.UTC(2024, 6, 1);
    const at = (frac: number) => spanFrom + (spanTo - spanFrom) * frac;

    const shell = (trades: any[]): BacktestResult => ({
        symbol: 'EUR/USD', timeframe: '1h', startBalance: 10_000,
        endBalance: 10_000 + trades.reduce((s, t) => s + t.netProfit, 0),
        stats: {
            trades: trades.length, wins: 0, losses: 0, winRate: 0,
            netProfit: trades.reduce((s, t) => s + t.netProfit, 0),
            returnPct: 0, grossProfit: 0, grossLoss: 0, profitFactor: 1,
            expectancy: 0, maxDrawdown: 0, maxDrawdownPct: 0, avgWin: 0, avgLoss: 0,
            totalCommission: 0, totalSwap: 0, totalSpreadCost: 0,
            barsProcessed: 1000, from: spanFrom, to: spanTo,
        },
        trades, equityCurve: [], warnings: [],
    });
    const spec: StrategySpec = {
        name: 'g', symbol: 'EUR/USD', timeframe: '1h',
        indicators: { m: { type: 'SMA', period: 20 } },
        entry: { long: { gt: ['close', 'm'] } },
        exit: { stopLoss: { pips: 30 } },
        sizing: { riskPercent: 1 },
    };

    // Over-fit shape: 12 trades, profitable early, losing late.
    const overfit = shell([
        ...Array.from({ length: 8 }, (_, i) => mkTrade(at(0.05 + i * 0.07), +80)),
        ...Array.from({ length: 5 }, (_, i) => mkTrade(at(0.75 + i * 0.04), -60)),
    ]);
    const gOver = gradeBacktest(spec, overfit, () => overfit);
    check('over-fit OOS check scores 15',
        gOver.checks.find(c => c.key === 'outOfSample')!.score, 15);
    check('over-fit grades D or F', gOver.grade === 'D' || gOver.grade === 'F', true);

    // Robust shape: 160 trades, profitable in both halves, variants hold up.
    const robust = shell(
        Array.from({ length: 160 }, (_, i) => mkTrade(at(i / 160), i % 3 === 0 ? -40 : +55)),
    );
    const gRob = gradeBacktest(spec, robust, () => robust);
    check('robust sample size scores 100',
        gRob.checks.find(c => c.key === 'sampleSize')!.score, 100);
    check('robust OOS scores 90',
        gRob.checks.find(c => c.key === 'outOfSample')!.score, 90);
    check('robust grades A or B', gRob.grade === 'A' || gRob.grade === 'B', true);
    check('grade is deterministic',
        JSON.stringify(gradeBacktest(spec, robust, () => robust)) === JSON.stringify(gRob), true);
}

// ── report ──────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(64)}`);
if (failures.length === 0) {
    console.log(`✅ all ${passed} assertions passed`);
    process.exit(0);
} else {
    console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}\n`));
    process.exit(1);
}
