/**
 * Candle store + live bar builder tests.
 *
 * The store is the backtester's data source, so its honesty properties are
 * what get tested: exact roundtrips, no duplicates on replay, month-file
 * splits that don't lose bars, and derived timeframes that never serve a
 * forming bucket. The live builder is tested as the feed sees it: quotes in,
 * closed bars out, nothing invented for quiet minutes.
 *
 * Run with:  npx ts-node src/services/candles/candles.test.ts
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { Bar } from '../strategy/types';
import {
    __setCandleRoot, appendBars, lastStoredTime, readBars, readBarsTf,
} from './store';
import { LiveBarBuilder } from './liveBars';

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

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'termax-candles-'));
__setCandleRoot(ROOT);

const MIN = 60_000;
const T0 = Date.UTC(2026, 0, 30, 10, 0, 0); // 2026-01-30 10:00 UTC

const bar = (time: number, o: number, h: number, l: number, c: number, v = 1): Bar =>
    ({ time, open: o, high: h, low: l, close: c, volume: v });

// ── store: roundtrip ────────────────────────────────────────────────
section('store: exact roundtrip');
{
    const input = [
        bar(T0 + 0 * MIN, 1.1000, 1.1010, 1.0990, 1.1005, 7),
        bar(T0 + 1 * MIN, 1.1005, 1.1020, 1.1000, 1.1015, 3),
        bar(T0 + 2 * MIN, 1.1015, 1.1030, 1.1010, 1.1025, 5),
    ];
    check('append writes all three', appendBars('EUR/USD', input), 3);

    const out = readBars('EUR/USD', T0, T0 + 3 * MIN);
    check('read returns three', out.length, 3);
    check('time exact', out[1].time, T0 + 1 * MIN);
    check('open exact', out[1].open, 1.1005);
    check('high exact', out[1].high, 1.1020);
    check('low exact', out[1].low, 1.1000);
    check('close exact', out[1].close, 1.1015);
    check('volume exact', out[1].volume, 3);
    check('lastStoredTime tracks tail', lastStoredTime('EUR/USD'), T0 + 2 * MIN);
}

// ── store: replay / out-of-order rejection ──────────────────────────
section('store: replayed and older bars are skipped');
{
    const replay = [
        bar(T0 + 1 * MIN, 9, 9, 9, 9),      // duplicate time
        bar(T0 + 2 * MIN, 9, 9, 9, 9),      // duplicate time
        bar(T0 + 3 * MIN, 1.1025, 1.1040, 1.1020, 1.1035, 2), // genuinely new
    ];
    check('only the new bar is written', appendBars('EUR/USD', replay), 1);

    const out = readBars('EUR/USD', T0, T0 + 4 * MIN);
    check('store holds four bars', out.length, 4);
    check('duplicate did not overwrite', out[1].open, 1.1005);
    check('non-finite bars are refused',
        appendBars('EUR/USD', [bar(T0 + 4 * MIN, NaN, 1, 1, 1)]), 0);
}

// ── store: restart re-reads the tail from disk ──────────────────────
section('store: lastStoredTime survives a restart');
{
    __setCandleRoot(ROOT); // clears the in-memory cache = simulated restart
    check('tail re-read from disk', lastStoredTime('EUR/USD'), T0 + 3 * MIN);
    check('replay after restart still skipped',
        appendBars('EUR/USD', [bar(T0 + 3 * MIN, 9, 9, 9, 9)]), 0);
}

// ── store: month split ──────────────────────────────────────────────
section('store: bars spanning a month boundary');
{
    const janEnd = Date.UTC(2026, 0, 31, 23, 59, 0);
    const febStart = Date.UTC(2026, 1, 1, 0, 0, 0);
    appendBars('GBP/USD', [
        bar(janEnd, 1.26, 1.26, 1.26, 1.26),
        bar(febStart, 1.27, 1.27, 1.27, 1.27),
        bar(febStart + MIN, 1.28, 1.28, 1.28, 1.28),
    ]);
    const dir = path.join(ROOT, 'GBP_USD');
    check('january file exists', fs.existsSync(path.join(dir, '2026-01.bin')), true);
    check('february file exists', fs.existsSync(path.join(dir, '2026-02.bin')), true);

    const all = readBars('GBP/USD', janEnd, febStart + 2 * MIN);
    check('read spans both months', all.length, 3);
    check('order preserved across files', all[0].close, 1.26);
    check('window start is inclusive', all[0].time, janEnd);
    const clipped = readBars('GBP/USD', febStart, febStart + MIN);
    check('window end is exclusive', clipped.length, 1);
}

// ── store: derived timeframe read ───────────────────────────────────
section('store: readBarsTf drops the forming bucket');
{
    // 12 one-minute bars from an exact 5m boundary: buckets [0-4] and [5-9]
    // close; minutes 10-11 form a partial bucket that must NOT be served.
    const H = Date.UTC(2026, 2, 2, 9, 0, 0);
    const bars: Bar[] = [];
    for (let i = 0; i < 12; i++) {
        bars.push(bar(H + i * MIN, 100 + i, 100 + i + 0.5, 100 + i - 0.5, 100 + i + 0.25, 2));
    }
    appendBars('SPX', bars);

    const fives = readBarsTf('SPX', '5m', H, H + 12 * MIN);
    check('two closed 5m buckets', fives.length, 2);
    check('bucket time is its start', fives[0].time, H);
    check('open = first minute open', fives[0].open, 100);
    check('high = max of bucket', fives[0].high, 104.5);
    check('low = min of bucket', fives[0].low, 99.5);
    check('close = last minute close', fives[0].close, 104.25);
    check('volume sums', fives[0].volume, 10);
    check('second bucket open', fives[1].open, 105);
    check('1m passthrough unchanged', readBarsTf('SPX', '1m', H, H + 12 * MIN).length, 12);
}

// ── live bars: quotes → closed minutes ──────────────────────────────
section('live bars: minute closes on roll, volume = tick count');
{
    const lb = new LiveBarBuilder(); // persists into the temp ROOT
    const emitted: { symbol: string; tf: string; bar: Bar }[] = [];
    lb.onBar((symbol, tf, b) => emitted.push({ symbol, tf, bar: b }));

    const M = Date.UTC(2026, 3, 6, 12, 0, 0);
    const q = (ts: number, bid: number, ask: number) =>
        lb.onQuote({ symbol: 'USD/JPY', bid, ask, ts });

    q(M + 1_000, 158.500, 158.502);  // mid 158.501
    q(M + 20_000, 158.520, 158.522); // mid 158.521 (high)
    q(M + 50_000, 158.480, 158.482); // mid 158.481 (low, close)
    check('no bar before the minute rolls', emitted.length, 0);

    q(M + MIN + 1_000, 158.490, 158.492); // rolls the minute
    check('one 1m bar emitted', emitted.length, 1);
    check('bar time is bucket start', emitted[0].bar.time, M);
    check('open is first mid', emitted[0].bar.open, 158.501, 1e-9);
    check('high is max mid', emitted[0].bar.high, 158.521, 1e-9);
    check('low is min mid', emitted[0].bar.low, 158.481, 1e-9);
    check('close is last mid', emitted[0].bar.close, 158.481, 1e-9);
    check('volume is the tick count', emitted[0].bar.volume, 3);

    // A stale quote (older than the forming bucket) must be ignored.
    lb.onQuote({ symbol: 'USD/JPY', bid: 1, ask: 1, ts: M + 30_000 });
    // Sweep closes the forming minute once its bucket has fully passed.
    lb.sweepNow(M + MIN); // bucket not yet over → no close
    check('sweep too early does nothing', emitted.length, 1);
    lb.sweepNow(M + 2 * MIN + 1);
    check('sweep closes the quiet minute', emitted.length, 2);
    check('stale quote never corrupted the bar', emitted[1].bar.low, 158.491, 1e-9);
    check('quiet-minute volume is its own ticks', emitted[1].bar.volume, 1);

    const stored = readBars('USD/JPY', M, M + 2 * MIN);
    check('closed minutes were persisted', stored.length, 2);
    check('persisted close matches emit', stored[0].close, 158.481, 1e-9);
}

// ── live bars: derived timeframes ───────────────────────────────────
section('live bars: 5m bar derives from closed minutes');
{
    const lb = new LiveBarBuilder({ persist: false });
    const fives: Bar[] = [];
    lb.onBar((_s, tf, b) => { if (tf === '5m') fives.push(b); });

    const H = Date.UTC(2026, 3, 7, 8, 0, 0); // exact 5m boundary
    for (let i = 0; i <= 5; i++) {
        lb.onQuote({ symbol: 'EUR/USD', bid: 1.1 + i * 0.001, ask: 1.1 + i * 0.001, ts: H + i * MIN });
    }
    // Minutes 0-4 closed; minute 5's bar is still forming.
    check('no 5m until its last minute closes', fives.length, 0);
    lb.sweepNow(H + 6 * MIN + 1); // closes minute 5 → aggregator sees next bucket
    check('5m bucket emitted', fives.length, 1);
    check('5m open = minute-0 mid', fives[0].open, 1.1, 1e-9);
    check('5m close = minute-4 mid', fives[0].close, 1.104, 1e-9);
    check('5m time is bucket start', fives[0].time, H);
}

// ── report ──────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(64)}`);
fs.rmSync(ROOT, { recursive: true, force: true });
if (failures.length === 0) {
    console.log(`✅ all ${passed} assertions passed`);
    process.exit(0);
} else {
    console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}\n`));
    process.exit(1);
}
