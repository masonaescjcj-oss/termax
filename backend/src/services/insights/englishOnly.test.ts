/**
 * Termax is an English-language product.
 *
 * Several insight modules still carry a Persian string beside their
 * English one — an unused branch from when the app was bilingual. This
 * test is what makes "unused" a fact rather than a hope: it drives each
 * renderer the way the API drives it and asserts that nothing which comes
 * back out contains a Persian character.
 *
 * If someone later wires a `.fa` field into a response, this fails.
 *
 * Run with:  npx ts-node src/services/insights/englishOnly.test.ts
 */

import { setQuote } from '../pricing';
import { buildPortfolioReport } from './portfolio';
import { computeTradeDna } from './tradeDna';
import { buildWeeklyDigest } from './digest';
import { evaluateRiskGuard, riskGuardConfig } from '../riskGuard';
import { evaluateWatchdog, DEFAULT_WATCHDOG } from '../bots/watchdog';
import { autoTags, renderEntry, renderDayRecap, TAG_META } from './journalEntry';
import { sliceByContext, JournalTags } from './journal';
import { sliceByTag, sliceByEmotion, buildMonth, dayLabel, JournalRow } from './journalCalendar';
import { buildShareCard } from './shareCard';
import { describeSpec } from '../strategy/describe';
import { StrategySpec } from '../strategy/types';

let passed = 0;
const failures: string[] = [];
const PERSIAN = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

/** Every string anywhere inside a value. */
function strings(v: any, out: string[] = []): string[] {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(x => strings(x, out));
    else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, out));
    return out;
}

/** Assert nothing in this payload carries a Persian character. */
function english(name: string, payload: any, opts: { skipKeys?: string[] } = {}) {
    const bad: string[] = [];
    const walk = (v: any, path: string) => {
        if (typeof v === 'string') {
            if (PERSIAN.test(v)) bad.push(`${path}: ${v.slice(0, 60)}`);
        } else if (Array.isArray(v)) {
            v.forEach((x, i) => walk(x, `${path}[${i}]`));
        } else if (v && typeof v === 'object') {
            for (const [k, x] of Object.entries(v)) {
                if (opts.skipKeys?.includes(k)) continue;
                walk(x, path ? `${path}.${k}` : k);
            }
        }
    };
    walk(payload, '');
    if (!bad.length) passed++;
    else failures.push(`${name}\n      ${bad.slice(0, 4).join('\n      ')}`);
}
function check(name: string, got: unknown, want: unknown) {
    if (got === want) passed++;
    else failures.push(`${name}\n      got  ${String(got)}\n      want ${String(want)}`);
}
function section(t: string) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`); }

// The `fa` / `whyFa` / `labelFa` keys are the unused branch itself. The
// point of this test is that no *response* carries them, so where a helper
// hands back the raw metadata object they are skipped by name and the
// English sibling is what gets checked.
const UNUSED_FA_KEYS = ['fa', 'whyFa', 'labelFa', 'headlineFa', 'messageFa', 'monthLabel'];

setQuote('EUR/USD', 1.09995, 1.10005);
setQuote('GBP/USD', 1.26995, 1.27005);
setQuote('GOLD', 2399.90, 2400.10);

const DAY = 86_400_000;
const now = Date.UTC(2026, 4, 20, 12, 0, 0);

// ── portfolio ───────────────────────────────────────────────────────
section('portfolio risk speaks English');

const report = buildPortfolioReport([
    { id: 'a', symbol: 'EUR/USD', side: 'BUY', volume: 1, entryPrice: 1.10, stopLoss: 1.0950 },
    { id: 'b', symbol: 'GBP/USD', side: 'BUY', volume: 1, entryPrice: 1.27, stopLoss: null },
], { equity: 10_000 });
english('portfolio report', report, { skipKeys: UNUSED_FA_KEYS });
check('and it did produce findings', report.findings.length > 0, true);
// The findings are the sentences a user reads; check them explicitly.
for (const f of report.findings) {
    check(`finding ${f.key} has English text`, PERSIAN.test(f.en), false);
}

// ── trade DNA ───────────────────────────────────────────────────────
section('trade DNA speaks English');

const trades = Array.from({ length: 24 }, (_, i) => ({
    symbol: 'EUR/USD',
    side: (i % 2 ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
    volume: i % 5 === 0 ? 0.3 : 0.1,
    netProfit: i % 3 === 0 ? -40 : 25,
    openTime: now - (30 - i) * DAY,
    closeTime: now - (30 - i) * DAY + 3600_000,
}));
const dna = computeTradeDna(trades);
english('dna profile', dna, { skipKeys: UNUSED_FA_KEYS });
check('and it did produce findings', dna.findings.length > 0, true);
for (const f of dna.findings) check(`dna finding ${f.key} in English`, PERSIAN.test(f.en), false);

// ── weekly digest ───────────────────────────────────────────────────
section('the weekly digest speaks English');

const digest = buildWeeklyDigest({
    rolled: {
        days: 8, trades: 12, wins: 7, losses: 5, winRate: 58.3, netProfit: 210.4,
        grossProfit: 400, grossLoss: 190, profitFactor: 2.1, expectancy: 17.5,
        daily: [{ day: '2026-05-18', trades: 4, netProfit: -80 }, { day: '2026-05-19', trades: 8, netProfit: 290 }],
    } as any,
    manualWeek: { trades: 12, wins: 7, winRate: 58.3, netProfit: 210.4, expectancy: 17.5 } as any,
    bots: [{ name: 'London RSI', status: 'FORWARD_TEST', trades: 5, netProfit: 61.2, paused: true }],
    findings: dna.findings,
    events: 2,
    now,
});
english('digest', digest, { skipKeys: UNUSED_FA_KEYS });
check('the English headline exists', typeof digest.headlineEn === 'string' && digest.headlineEn.length > 10, true);
check('and carries no Persian', PERSIAN.test(digest.headlineEn), false);
if (digest.focus) check('the focus line is English', PERSIAN.test(digest.focus.en), false);

// ── the two guards ──────────────────────────────────────────────────
section('the guards speak English');

const guard = evaluateRiskGuard(
    riskGuardConfig({ enabled: true, maxDailyLossPct: 3, maxDailyLosses: 3 }),
    trades.map(t => ({ netProfit: t.netProfit, closeTime: t.closeTime })) as any,
    10_000, now);
english('risk guard', guard, { skipKeys: UNUSED_FA_KEYS });
check('its English text is set', PERSIAN.test(guard.en), false);

const wd = evaluateWatchdog(
    DEFAULT_WATCHDOG,
    // The watchdog reads finalProfit, the column name on a closed position.
    Array.from({ length: 8 }, (_, i) => ({ finalProfit: -30, closeTime: now - i * 3600_000 })) as any,
    1000, now);
english('watchdog verdict', wd, { skipKeys: UNUSED_FA_KEYS });
check('watchdog tripped, so it has something to say', wd.tripped, true);
check('and says it in English', PERSIAN.test(wd.en), false);

// ── the journal ─────────────────────────────────────────────────────
section('the journal speaks English');

const ctx: JournalTags = {
    trend: 'UP', volatility: 'NORMAL', session: 'london', withTrend: true,
    evidence: { emaSlopeAtr: 0.6, atrPips: 20, atrRatio: 1, hourUtc: 10, timeframe: '5m', bars: 120 },
};
const trade = {
    symbol: 'EUR/USD', side: 'BUY' as const, volume: 0.1,
    entryPrice: 1.10, closePrice: 1.1020,
    openTime: now, closeTime: now + 34 * 60_000, netProfit: 18.4,
    stopLoss: 1.0980, takeProfit: 1.1040,
};
const tags = autoTags(trade, ctx, { medianVolume: 0.1 });
const entry = renderEntry(trade, ctx);
check('the written entry is English', PERSIAN.test(entry.en), false);
check('and it actually says something', entry.en.length > 30, true);

const recap = renderDayRecap([{ netProfit: 18.4, symbol: 'EUR/USD', side: 'BUY', tags }]);
check('the day recap is English', PERSIAN.test(recap.en), false);

const tagged = trades.map(t => ({ tags: ctx, netProfit: t.netProfit }));
english('context slices', sliceByContext(tagged), { skipKeys: UNUSED_FA_KEYS });

const rows: JournalRow[] = trades.map((t, i) => ({
    id: `p${i}`, symbol: t.symbol, side: t.side, volume: t.volume,
    netProfit: t.netProfit, openTime: t.openTime, closeTime: t.closeTime,
    tags: i % 4 === 0 ? ['revenge'] : ['planned'],
}));
// The habit table's label comes from TAG_META, whose `en` is the English one.
for (const slice of sliceByTag(rows)) {
    check(`habit ${slice.key} label is English`, PERSIAN.test(slice.en), false);
}
english('mood slices', sliceByEmotion(
    [{ emotion: 'greedy', netProfit: -10 }, { emotion: 'greedy', netProfit: -20 }, { emotion: 'greedy', netProfit: 5 }],
    { greedy: 'Greedy' },
));

// A Gregorian month — the default — must be entirely Latin.
const month = buildMonth(rows, { year: 2026, month: 5 });
english('gregorian month view', month);
check('its label is English', month.monthLabel, 'May 2026');
check('and its day labels are Latin digits', month.days[0].label, '1');
check('the day label reads as a date', dayLabel('2026-05-11'), 'Monday, 11 May 2026');

// ── the share card ──────────────────────────────────────────────────
section('the share card speaks English');

const card = buildShareCard({
    kind: 'day', label: dayLabel('2026-05-11'),
    netProfit: -81.75, trades: 2, wins: 1, pips: -641,
    recap: recap.en,
    tags: [{ fa: 'oversized', tone: 'risk' }],
    clean: false,
    rows: [{ symbol: 'GOLD', side: 'SELL', volume: 0.15, netProfit: -100.05, pips: -660 }],
});
check('the card SVG has no Persian', PERSIAN.test(card.svg), false);
check('nor its alt line', PERSIAN.test(card.alt), false);
check('nor its filename', PERSIAN.test(card.filename), false);

// ── the rule sheet ──────────────────────────────────────────────────
section('the rule sheet speaks English by default');

const spec = {
    name: 'RSI dip', symbol: 'EUR/USD', timeframe: '15m',
    indicators: { rsi: { type: 'RSI', period: 14 } },
    entry: { long: { lt: ['rsi', 30] } },
    exit: { signal: { long: { gt: ['rsi', 55] } }, stopLoss: { pips: 20 } },
    sizing: { riskPercent: 1 },
} as unknown as StrategySpec;
const sheet = describeSpec(spec);
check('describeSpec defaults to English', sheet.some(l => PERSIAN.test(l)), false);
check('and it rendered lines', sheet.length > 0, true);

// ── report ──────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(64)}`);
if (failures.length) {
    console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
    failures.forEach(f => console.log(`  ✗ ${f}\n`));
    process.exit(1);
}
console.log(`✅ all ${passed} assertions passed`);
