/**
 * BINARY CANDLE STORE
 *
 * One-minute candles on disk, one file per symbol per UTC month, fixed
 * 48-byte records (six float64s: time, open, high, low, close, volume),
 * append-only. Higher timeframes are derived on read via the aggregator.
 *
 * Why files and not the database: a candle row in Postgres costs 60–100
 * bytes plus index churn and a network round trip; the same candle here is
 * 48 bytes and a sequential read. Three years of 1m data for 50 symbols is
 * a few gigabytes on disk versus tens in the database — and backtests read
 * candles in exactly the access pattern disks are fastest at. See
 * docs/ai-architecture.md §3 rule 4.
 */

import fs from 'fs';
import path from 'path';
import { BarAggregator } from '../strategy/series';
import { Bar, TIMEFRAME_MS, Timeframe } from '../strategy/types';

const RECORD = 48; // 6 x float64
const FIELDS = 6;

let ROOT = process.env.CANDLE_DIR || path.join(process.cwd(), 'data', 'candles');

/** Testing seam — point the store at a temp directory. */
export function __setCandleRoot(dir: string): void {
    ROOT = dir;
    lastTimes.clear();
}

const safe = (symbol: string) => symbol.replace(/[^A-Za-z0-9]+/g, '_');

function monthKey(time: number): string {
    const d = new Date(time);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function fileFor(symbol: string, time: number): string {
    return path.join(ROOT, safe(symbol), `${monthKey(time)}.bin`);
}

/** Last stored bar time per symbol, so appends can reject out-of-order data. */
const lastTimes = new Map<string, number>();

function listMonthFiles(symbol: string): string[] {
    const dir = path.join(ROOT, safe(symbol));
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => /^\d{4}-\d{2}\.bin$/.test(f))
        .sort()
        .map(f => path.join(dir, f));
}

function readLastTimeFromDisk(symbol: string): number {
    const files = listMonthFiles(symbol);
    if (!files.length) return -Infinity;
    const last = files[files.length - 1];
    const size = fs.statSync(last).size;
    if (size < RECORD) return -Infinity;
    const fd = fs.openSync(last, 'r');
    try {
        const buf = Buffer.alloc(8);
        fs.readSync(fd, buf, 0, 8, size - RECORD);
        return buf.readDoubleLE(0);
    } finally {
        fs.closeSync(fd);
    }
}

export function lastStoredTime(symbol: string): number {
    if (!lastTimes.has(symbol)) lastTimes.set(symbol, readLastTimeFromDisk(symbol));
    return lastTimes.get(symbol)!;
}

/**
 * Append 1m bars, oldest first. Bars at or before the last stored time are
 * skipped silently — feeds overlap on reconnect and backfill, and replaying
 * an overlap must not duplicate records.
 * Returns how many bars were actually written.
 */
export function appendBars(symbol: string, bars: Bar[]): number {
    if (!bars.length) return 0;
    let last = lastStoredTime(symbol);
    let written = 0;

    let currentFile: string | null = null;
    let fd: number | null = null;
    const buf = Buffer.alloc(RECORD);

    try {
        for (const bar of bars) {
            if (!(bar.time > last)) continue;
            if (![bar.open, bar.high, bar.low, bar.close].every(Number.isFinite)) continue;

            const file = fileFor(symbol, bar.time);
            if (file !== currentFile) {
                if (fd !== null) fs.closeSync(fd);
                fs.mkdirSync(path.dirname(file), { recursive: true });
                fd = fs.openSync(file, 'a');
                currentFile = file;
            }
            buf.writeDoubleLE(bar.time, 0);
            buf.writeDoubleLE(bar.open, 8);
            buf.writeDoubleLE(bar.high, 16);
            buf.writeDoubleLE(bar.low, 24);
            buf.writeDoubleLE(bar.close, 32);
            buf.writeDoubleLE(bar.volume, 40);
            fs.writeSync(fd!, buf);
            last = bar.time;
            written++;
        }
    } finally {
        if (fd !== null) fs.closeSync(fd);
    }

    lastTimes.set(symbol, last);
    return written;
}

/** Read stored 1m bars in [fromMs, toMs), oldest first. */
export function readBars(symbol: string, fromMs: number, toMs: number): Bar[] {
    const out: Bar[] = [];
    for (const file of listMonthFiles(symbol)) {
        // Skip whole months outside the window without opening them.
        const key = path.basename(file, '.bin');
        const [y, m] = key.split('-').map(Number);
        const monthStart = Date.UTC(y, m - 1, 1);
        const monthEnd = Date.UTC(y, m, 1);
        if (monthEnd <= fromMs || monthStart >= toMs) continue;

        const raw = fs.readFileSync(file);
        const n = Math.floor(raw.length / RECORD);
        for (let i = 0; i < n; i++) {
            const off = i * RECORD;
            const time = raw.readDoubleLE(off);
            if (time < fromMs) continue;
            if (time >= toMs) break;
            out.push({
                time,
                open: raw.readDoubleLE(off + 8),
                high: raw.readDoubleLE(off + 16),
                low: raw.readDoubleLE(off + 24),
                close: raw.readDoubleLE(off + 32),
                volume: raw.readDoubleLE(off + 40),
            });
        }
    }
    return out;
}

/**
 * Read bars at any timeframe, derived from stored 1m data. Only CLOSED
 * buckets are returned — a partial bucket at the window's end is dropped,
 * because serving it as a bar would hand backtests a forming candle.
 */
export function readBarsTf(symbol: string, tf: Timeframe, fromMs: number, toMs: number): Bar[] {
    if (tf === '1m') return readBars(symbol, fromMs, toMs);

    // Pull enough leading 1m data to complete the first bucket.
    const lead = TIMEFRAME_MS[tf];
    const raw = readBars(symbol, Math.floor(fromMs / lead) * lead, toMs);

    const agg = new BarAggregator(tf);
    const out: Bar[] = [];
    for (const bar of raw) {
        const done = agg.push(bar);
        if (done && done.time >= fromMs) out.push(done);
    }
    return out;
}
