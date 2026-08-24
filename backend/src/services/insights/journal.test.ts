/**
 * Auto-journal + weekly digest tests — regimes built on purpose, then
 * classified; slices that must drop noise; a digest whose headline
 * matches its inputs.
 *
 * Run with:  npx ts-node src/services/insights/journal.test.ts
 */

import { Bar } from '../strategy/types';
import { classifyContext, contextTimeframe, sliceByContext, JournalTags } from './journal';
import { buildWeeklyDigest } from './digest';

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
const HOUR = 3600_000;

/** A run of bars with a per-bar drift and a per-bar range. */
function series(count: number, start: number, drift: number, range: number, t0: number, stepMs = 5 * MIN): Bar[] {
    const bars: Bar[] = [];
    let px = start;
    for (let i = 0; i < count; i++) {
        const close = px + drift;
        bars.push({ time: t0 + i * stepMs, open: px, high: Math.max(px, close) + range / 2, low: Math.min(px, close) - range / 2, close, volume: 1 });
        px = close;
    }
    return bars;
}

// London session is 07:00-16:00 UTC in the engine's table.
const ENTRY = Date.UTC(2026, 5, 10, 10, 0);

section('trend classification');
{
    const trade = { symbol: 'EUR/USD' as const, side: 'BUY' as const, openTime: ENTRY, closeTime: ENTRY + HOUR };

    // Strong uptrend: drift is large relative to the bar range.
    const up = classifyContext(trade, series(140, 1.1000, 0.0006, 0.0004, ENTRY - 140 * 5 * MIN));
    check('rising market reads UP', up.trend, 'UP');
    check('slope measured in ATR units', (up.evidence.emaSlopeAtr ?? 0) > 0, true);
    check('a BUY in an uptrend is with-trend', up.withTrend, true);

    const down = classifyContext({ ...trade, side: 'SELL' }, series(140, 1.1000, -0.0006, 0.0004, ENTRY - 140 * 5 * MIN));
    check('falling market reads DOWN', down.trend, 'DOWN');
    check('a SELL in a downtrend is with-trend', down.withTrend, true);

    const buyIntoDown = classifyContext(trade, series(140, 1.1000, -0.0006, 0.0004, ENTRY - 140 * 5 * MIN));
    check('a BUY in a downtrend is against', buyIntoDown.withTrend, false);

    // Chop: no drift, wide bars.
    const flat = series(140, 1.1000, 0, 0.0010, ENTRY - 140 * 5 * MIN).map((b, i) => ({
        ...b, close: 1.1000 + (i % 2 ? 0.0004 : -0.0004),
    }));
    const range = classifyContext(trade, flat);
    check('choppy market reads RANGE', range.trend, 'RANGE');
    check('with-trend is undefined in a range', range.withTrend, null);
}

section('volatility against the market own normal');
{
    const trade = { symbol: 'EUR/USD' as const, side: 'BUY' as const, openTime: ENTRY, closeTime: ENTRY + HOUR };

    // 100 calm bars, then 20 bars with 4x the range: the entry is WILD.
    const calm = series(110, 1.1000, 0.0001, 0.0003, ENTRY - 130 * 5 * MIN);
    const wild = series(20, calm[calm.length - 1].close, 0.0001, 0.0016, ENTRY - 20 * 5 * MIN);
    const v = classifyContext(trade, [...calm, ...wild]);
    check('volatility spike reads WILD', v.volatility, 'WILD');
    check('ratio above 1.5', (v.evidence.atrRatio ?? 0) >= 1.5, true);
    check('ATR reported in pips', (v.evidence.atrPips ?? 0) > 0, true);

    // Uniform bars: the ratio sits at 1, so NORMAL.
    const steady = classifyContext(trade, series(140, 1.1000, 0.0001, 0.0005, ENTRY - 140 * 5 * MIN));
    check('uniform market reads NORMAL', steady.volatility, 'NORMAL');
}

section('session and timeframe selection');
{
    const bars = series(140, 1.1000, 0.0001, 0.0004, ENTRY - 140 * 5 * MIN);
    check('10:00 UTC is london', classifyContext({ symbol: 'EUR/USD', side: 'BUY', openTime: ENTRY, closeTime: ENTRY + HOUR }, bars).session, 'london');

    const tokyoEntry = Date.UTC(2026, 5, 10, 3, 0);
    const tokyoBars = series(140, 1.1000, 0.0001, 0.0004, tokyoEntry - 140 * 5 * MIN);
    check('03:00 UTC is tokyo', classifyContext({ symbol: 'EUR/USD', side: 'BUY', openTime: tokyoEntry, closeTime: tokyoEntry + HOUR }, tokyoBars).session, 'tokyo');

    check('a 30-minute trade uses 5m context', contextTimeframe(30 * MIN), '5m');
    check('a 6-hour trade uses 15m', contextTimeframe(6 * HOUR), '15m');
    check('a 2-day trade uses 1h', contextTimeframe(2 * 86_400_000), '1h');
    check('a 2-week trade uses 4h', contextTimeframe(14 * 86_400_000), '4h');
}

section('thin history is admitted, not guessed');
{
    const thin = classifyContext(
        { symbol: 'EUR/USD', side: 'BUY', openTime: ENTRY, closeTime: ENTRY + HOUR },
        series(20, 1.1000, 0.0005, 0.0004, ENTRY - 20 * 5 * MIN),
    );
    check('too few bars -> RANGE/NORMAL', thin.trend, 'RANGE');
    check('and no slope evidence', thin.evidence.emaSlopeAtr, null);
    check('bar count reported', thin.evidence.bars, 20);
}

section('no hindsight: bars at or after the entry are ignored');
{
    // A violent up-move AFTER the entry must not colour the context.
    const before = series(140, 1.1000, 0, 0.0004, ENTRY - 140 * 5 * MIN);
    const after = series(40, 1.1000, 0.0030, 0.0020, ENTRY);
    const tags = classifyContext({ symbol: 'EUR/USD', side: 'BUY', openTime: ENTRY, closeTime: ENTRY + 3 * HOUR }, [...before, ...after]);
    check('post-entry bars excluded from the count', tags.evidence.bars, 140);
    check('and do not create a trend', tags.trend, 'RANGE');
}

section('slicing drops noise buckets');
{
    const t = (trend: any, vol: any, session: any, withTrend: any): JournalTags => ({
        trend, volatility: vol, session, withTrend,
        evidence: { emaSlopeAtr: 0, atrPips: 10, atrRatio: 1, hourUtc: 10, timeframe: '15m', bars: 120 },
    });
    const tagged = [
        ...Array.from({ length: 6 }, () => ({ tags: t('UP', 'NORMAL', 'london', true), netProfit: 30 })),
        ...Array.from({ length: 5 }, () => ({ tags: t('RANGE', 'WILD', 'newyork', null), netProfit: -40 })),
        // Only 2 trades: must be dropped as noise.
        ...Array.from({ length: 2 }, () => ({ tags: t('DOWN', 'QUIET', 'tokyo', false), netProfit: 500 })),
    ];
    const s = sliceByContext(tagged);
    check('two trend buckets survive', s.trend.length, 2);
    check('the 2-trade bucket is dropped', s.trend.some(x => x.key === 'DOWN'), false);
    check('best bucket first', s.trend[0].key, 'UP');
    check('win rate computed', s.trend[0].winRate, 100);
    check('expectancy computed', s.trend[0].expectancy, 30);
    check('losing bucket carries its loss', s.trend[1].netProfit, -200);
    check('persian labels present', s.trend[0].labelFa, 'روند صعودی');
    check('volatility sliced too', s.volatility.length, 2);
    check('with/against sliced', s.withTrend.length, 1);
    check('null with-trend excluded from that slice', s.withTrend[0].key, 'with');
}

section('weekly digest');
{
    const NOW = Date.UTC(2026, 5, 14, 12, 0);
    const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString().slice(0, 10);
    const digest = buildWeeklyDigest({
        now: NOW,
        rolled: {
            days: 8, trades: 12, wins: 7, losses: 5, winRate: 58.3, netProfit: 210,
            grossProfit: 400, grossLoss: 190, profitFactor: 2.1, expectancy: 17.5,
            daily: [
                { day: day(6), trades: 3, netProfit: -80 },
                { day: day(3), trades: 4, netProfit: 150 },
                { day: day(1), trades: 5, netProfit: 140 },
            ],
        },
        manualWeek: {
            trades: 12, wins: 7, losses: 5, winRate: 58.3, netProfit: 210, grossProfit: 400,
            grossLoss: 190, profitFactor: 2.1, expectancy: 17.5, maxDrawdown: 90,
            avgHoldMinutes: 45, firstTradeAt: NOW - 6 * 86_400_000, lastTradeAt: NOW,
        },
        bots: [
            { name: 'RSI London', status: 'FORWARD_TEST', trades: 5, netProfit: 60, paused: false },
            { name: 'BTC Momentum', status: 'STOPPED', trades: 3, netProfit: -25, paused: true },
        ],
        findings: [
            { key: 'worstHour', severity: 'INFO', fa: 'info line', en: 'info line', evidence: {} },
            { key: 'revengeTrading', severity: 'ALERT', fa: 'معامله‌ی انتقامی', en: 'revenge trading', evidence: {} },
        ],
        events: 3,
    });

    check('best day picked', digest.manual.bestDay?.netProfit, 150);
    check('worst day picked', digest.manual.worstDay?.netProfit, -80);
    check('bots net summed', digest.botsNet, 35);
    check('headline counts both sides', digest.headlineFa.includes('12'), true);
    check('headline totals manual + bots', digest.headlineFa.includes('245'), true);
    check('paused bot mentioned', digest.headlineFa.includes('1 ربات'), true);
    check('focus is the ALERT, not the INFO', digest.focus?.fa, 'معامله‌ی انتقامی');
    check('events counted', digest.events, 3);

    const quiet = buildWeeklyDigest({
        now: NOW,
        rolled: { days: 8, trades: 0, wins: 0, losses: 0, winRate: 0, netProfit: 0, grossProfit: 0, grossLoss: 0, profitFactor: 0, expectancy: 0, daily: [] },
        manualWeek: { trades: 0, wins: 0, losses: 0, winRate: 0, netProfit: 0, grossProfit: 0, grossLoss: 0, profitFactor: 0, expectancy: 0, maxDrawdown: 0, avgHoldMinutes: 0, firstTradeAt: null, lastTradeAt: null },
        bots: [], findings: [], events: 0,
    });
    check('a quiet week says so', quiet.headlineFa, 'این هفته معامله‌ای بسته نشد.');
    check('and has no focus line', quiet.focus, null);
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
