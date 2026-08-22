/**
 * Trade DNA + autopsy tests — crafted trade sequences with hand-verifiable
 * behavioural patterns, and an autopsy over seeded candles whose MFE/MAE
 * are computed by hand.
 *
 * Run with:  npx ts-node src/services/insights/insights.test.ts
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { computeTradeDna, DnaTrade } from './tradeDna';
import { autopsyTimeframe, runAutopsy } from './autopsy';
import { __setCandleRoot, appendBars } from '../candles/store';
import { Bar } from '../strategy/types';

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
const DAY = 86_400_000;
// Monday 2024-01-08 00:00 UTC as a stable anchor.
const T0 = Date.UTC(2024, 0, 8);

const trade = (openMs: number, holdMin: number, net: number, volume = 0.1, symbol = 'EUR/USD'): DnaTrade => ({
    symbol, side: 'BUY', volume, netProfit: net,
    openTime: openMs, closeTime: openMs + holdMin * MIN,
});

// ── revenge trading ─────────────────────────────────────────────────
section('DNA: revenge trading is counted, not vibed');
{
    const ts: DnaTrade[] = [];
    // 10 calm profitable trades on different days, spaced far apart.
    for (let i = 0; i < 10; i++) ts.push(trade(T0 + i * DAY + 10 * HOUR, 60, +30));
    // 4 loss -> instant re-entry pairs: the re-entry loses too.
    for (let i = 0; i < 4; i++) {
        const base = T0 + (20 + i) * DAY + 12 * HOUR;
        ts.push(trade(base, 30, -40));                      // the loss
        ts.push(trade(base + 40 * MIN, 20, -25));           // opened 10 min after it closed
    }
    const dna = computeTradeDna(ts, T0 + 40 * DAY);
    const f = dna.findings.find(x => x.key === 'revengeTrading');
    check('finding exists', !!f, true);
    check('counts exactly the 4 re-entries', f!.evidence.revengeTrades, 4);
    check('severity ALERT on losing revenge', f!.severity, 'ALERT');
    check('persian text carries the count', f!.fa.includes('4 معامله'), true);

    // Without the rapid re-entries there is no finding.
    const calm = computeTradeDna(ts.slice(0, 10), T0 + 40 * DAY);
    check('calm record has no revenge finding', calm.findings.some(x => x.key === 'revengeTrading'), false);
}

// ── disposition effect ──────────────────────────────────────────────
section('DNA: cutting winners, riding losers');
{
    const ts: DnaTrade[] = [];
    for (let i = 0; i < 6; i++) ts.push(trade(T0 + i * DAY, 10, +8));      // small fast wins
    for (let i = 0; i < 6; i++) ts.push(trade(T0 + (10 + i) * DAY, 120, -35)); // long big losses
    const dna = computeTradeDna(ts, T0 + 30 * DAY);
    const f = dna.findings.find(x => x.key === 'dispositionEffect');
    check('finding exists', !!f, true);
    check('win hold 10 min', f!.evidence.winHoldMin, 10, 1e-9);
    check('loss hold 120 min', f!.evidence.lossHoldMin, 120, 1e-9);
    check('severity ALERT', f!.severity, 'ALERT');
}

// ── worst hour + volume creep ───────────────────────────────────────
section('DNA: worst hour and martingale drift');
{
    const ts: DnaTrade[] = [];
    // 6 losing trades all at 14:00 UTC, 6 winners spread at 09:00.
    for (let i = 0; i < 6; i++) ts.push(trade(T0 + i * DAY + 14 * HOUR, 30, -20, 0.1));
    for (let i = 0; i < 6; i++) ts.push(trade(T0 + (10 + i) * DAY + 9 * HOUR, 30, +25, 0.1));
    // Volume creep: alternate loss then double-size next trade.
    for (let i = 0; i < 5; i++) {
        ts.push(trade(T0 + (20 + i) * DAY + 10 * HOUR, 30, -15, 0.1));
        ts.push(trade(T0 + (20 + i) * DAY + 12 * HOUR, 30, +5, 0.25));
    }
    const dna = computeTradeDna(ts, T0 + 40 * DAY);
    const worst = dna.findings.find(x => x.key === 'worstHour');
    check('worst hour found', !!worst, true);
    check('worst hour is 14 UTC', worst!.evidence.hourUtc, 14);
    const creep = dna.findings.find(x => x.key === 'volumeCreepAfterLoss');
    check('volume creep found', !!creep, true);
    check('ratio ~1.68x (hand-traced sequence)', Number(creep!.evidence.ratio), 1.68, 0.02);
    check('hourly bucket sums', dna.hourly[14].netProfit, -120, 1e-9);
}

// ── autopsy ─────────────────────────────────────────────────────────
section('autopsy: stopped-then-reversed, from real candles');
{
    check('short hold -> 1m', autopsyTimeframe(30 * MIN), '1m');
    check('day hold -> 15m', autopsyTimeframe(20 * HOUR), '15m');

    const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'termax-autopsy-'));
    __setCandleRoot(ROOT);

    // 1m candles: flat 1.1000 for 80 bars, then a dip to 1.0980 that stops
    // the trade, then a rally to 1.1040 (the reversal), then flat.
    const S = Date.UTC(2024, 1, 5, 9, 0);
    const bars: Bar[] = [];
    for (let i = 0; i < 200; i++) {
        let mid = 1.1000;
        if (i >= 100 && i < 105) mid = 1.0985;             // the stop-run dip
        if (i >= 105 && i < 130) mid = 1.1000 + (i - 105) * 0.0002; // reversal up
        if (i >= 130) mid = 1.1050;
        bars.push({ time: S + i * MIN, open: mid, high: mid + 0.0003, low: mid - 0.0005, close: mid, volume: 1 });
    }
    appendBars('EUR/USD', bars);

    // BUY at bar 90 (1.1000), SL 1.0982 (18 pips), stopped in the dip at
    // bar ~101. Aftermath: price reaches 1.1050+0.0003 -> ~68+ pips beyond
    // the exit. Verdict must be stopped-then-reversed.
    const report = runAutopsy({
        symbol: 'EUR/USD', side: 'BUY', volume: 0.1,
        entryPrice: 1.1000, closePrice: 1.0982,
        openTime: S + 90 * MIN, closeTime: S + 101 * MIN,
        netProfit: -18, stopLoss: 1.0982, takeProfit: null,
        commission: -0.7, swap: 0,
    });
    check('autopsy runs', (report as any).ok, true);
    if (report.ok) {
        check('uses 1m candles', report.timeframe, '1m');
        check('closed pips -18', report.facts.pips, -18, 0.2);
        // MAE: low of dip bars = 1.0985-0.0005 = 1.0980 -> 20 pips against.
        check('MAE 20 pips', report.facts.maePips, 20, 0.5);
        const v = report.verdicts.find(x => x.key === 'stoppedThenReversed');
        check('stopped-then-reversed detected', !!v, true);
        check('aftermath move exceeds the stop', report.facts.afterExitPips >= 18, true);
        check('persian verdict present', v!.fa.includes('پیپ'), true);
        check('candle window ships for the client', report.candles.length > 30, true);
    }

    // A clean loss: stopped and price kept falling. No reversal verdict.
    const S2 = Date.UTC(2024, 1, 6, 9, 0);
    const bars2: Bar[] = [];
    for (let i = 0; i < 200; i++) {
        const mid = 1.2000 - i * 0.0002; // steady decline
        bars2.push({ time: S2 + i * MIN, open: mid, high: mid + 0.0002, low: mid - 0.0002, close: mid, volume: 1 });
    }
    appendBars('GBP/USD', bars2);
    const clean = runAutopsy({
        symbol: 'GBP/USD', side: 'BUY', volume: 0.1,
        entryPrice: 1.1840, closePrice: 1.1820,
        openTime: S2 + 80 * MIN, closeTime: S2 + 90 * MIN,
        netProfit: -20, stopLoss: 1.1820, takeProfit: null,
        commission: -0.7, swap: 0,
    });
    check('clean loss runs', (clean as any).ok, true);
    if (clean.ok) {
        check('no reversal verdict on a clean loss', clean.verdicts.some(v => v.key === 'stoppedThenReversed'), false);
        check('clean-loss verdict shows instead', clean.verdicts.some(v => v.key === 'cleanLossOrWin' || v.key === 'counterTrend'), true);
    }

    // Missing history fails honestly.
    const missing = runAutopsy({
        symbol: 'USD/JPY', side: 'BUY', volume: 0.1,
        entryPrice: 150, closePrice: 149,
        openTime: S2, closeTime: S2 + HOUR,
        netProfit: -67, stopLoss: 149,
    });
    check('missing candles -> honest refusal', (missing as any).ok, false);

    fs.rmSync(ROOT, { recursive: true, force: true });
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
