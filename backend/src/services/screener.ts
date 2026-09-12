/**
 * MARKET SCREENER
 *
 * One table of every instrument the terminal knows, with the handful of
 * numbers a trader filters on: last, 24h change, RSI(14), where price sits
 * against the 20/50 EMAs, ATR as a percent, volume against its 20-bar
 * average, and distance to the 20-bar high/low.
 *
 * Computed from hourly bars fetched on a timer — never on request, and
 * never from the chart endpoint's synthetic fallback: a symbol whose
 * source is down is simply absent from the table rather than ranked on
 * invented data.
 */
import { knownSymbols } from '../config/instruments';
import { loadSourceCandles } from '../controllers/marketController';

export interface BarLike { timestamp: number; open: number; high: number; low: number; close: number; volume: number }

export interface ScreenRow {
    symbol: string;
    last: number;
    change24hPct: number | null;
    rsi14: number | null;
    ema20: number | null;
    ema50: number | null;
    /** 'up' when EMA20 > EMA50 and price above both; 'down' the mirror; else 'flat'. */
    trend: 'up' | 'down' | 'flat';
    atrPct: number | null;
    volumeRatio: number | null;
    high20: number;
    low20: number;
    /** Position in the 20-bar range, 0 = at the low, 100 = at the high. */
    rangePos: number | null;
    bars: number;
    updatedAt: number;
}

/* ── Pure indicator maths (exported for the tests) ───────────────────── */

export function ema(values: number[], period: number): number | null {
    if (values.length < period) return null;
    const k = 2 / (period + 1);
    let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
    return e;
}

export function rsi(closes: number[], period = 14): number | null {
    if (closes.length <= period) return null;
    let gain = 0, loss = 0;
    for (let i = 1; i <= period; i++) {
        const d = closes[i] - closes[i - 1];
        if (d >= 0) gain += d; else loss -= d;
    }
    let avgGain = gain / period, avgLoss = loss / period;
    for (let i = period + 1; i < closes.length; i++) {
        const d = closes[i] - closes[i - 1];
        avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    }
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
}

export function atr(bars: BarLike[], period = 14): number | null {
    if (bars.length <= period) return null;
    const trs: number[] = [];
    for (let i = 1; i < bars.length; i++) {
        const b = bars[i], p = bars[i - 1];
        trs.push(Math.max(b.high - b.low, Math.abs(b.high - p.close), Math.abs(b.low - p.close)));
    }
    let a = trs.slice(0, period).reduce((x, y) => x + y, 0) / period;
    for (let i = period; i < trs.length; i++) a = (a * (period - 1) + trs[i]) / period;
    return a;
}

export function computeRow(symbol: string, bars: BarLike[], now = Date.now()): ScreenRow | null {
    const clean = bars.filter(b => Number.isFinite(b.close) && Number.isFinite(b.high) && Number.isFinite(b.low));
    if (clean.length < 5) return null;
    const closes = clean.map(b => b.close);
    const last = closes[closes.length - 1];
    const ago24 = closes.length > 24 ? closes[closes.length - 25] : clean[0].close;
    const e20 = ema(closes, 20), e50 = ema(closes, 50);
    const window20 = clean.slice(-20);
    const high20 = Math.max(...window20.map(b => b.high));
    const low20 = Math.min(...window20.map(b => b.low));
    const vols = clean.slice(-21, -1).map(b => b.volume).filter(v => Number.isFinite(v) && v > 0);
    const avgVol = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : 0;
    const lastVol = clean[clean.length - 1].volume;
    const a = atr(clean);
    let trend: ScreenRow['trend'] = 'flat';
    if (e20 != null && e50 != null) {
        if (e20 > e50 && last > e20) trend = 'up';
        else if (e20 < e50 && last < e20) trend = 'down';
    }
    return {
        symbol, last,
        change24hPct: ago24 ? ((last - ago24) / ago24) * 100 : null,
        rsi14: rsi(closes),
        ema20: e20, ema50: e50, trend,
        atrPct: a != null && last ? (a / last) * 100 : null,
        volumeRatio: avgVol > 0 && Number.isFinite(lastVol) ? lastVol / avgVol : null,
        high20, low20,
        rangePos: high20 > low20 ? ((last - low20) / (high20 - low20)) * 100 : null,
        bars: clean.length,
        updatedAt: now,
    };
}

/* ── The cached table ────────────────────────────────────────────────── */

const rows = new Map<string, ScreenRow>();
let lastRun = 0;
let running = false;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const screener = {
    rows(): ScreenRow[] { return [...rows.values()]; },
    updatedAt(): number { return lastRun; },
    isRunning(): boolean { return running; },

    /** Fetch hourly bars for every known symbol, gently, and rebuild the table. */
    async refresh(symbols: string[] = knownSymbols(), pauseMs = 250): Promise<number> {
        if (running) return rows.size;
        running = true;
        let ok = 0;
        try {
            for (const symbol of symbols) {
                try {
                    const raw = await loadSourceCandles(symbol, '1h', 120);
                    const bars: BarLike[] = raw.map((c: any) => ({
                        timestamp: new Date(c.timestamp).getTime(), open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close), volume: Number(c.volume) || 0,
                    }));
                    const row = computeRow(symbol, bars);
                    if (row) { rows.set(symbol, row); ok++; }
                } catch (e: any) {
                    console.warn(`[screener] ${symbol}: ${e.message}`);
                }
                await sleep(pauseMs);
            }
            lastRun = Date.now();
        } finally {
            running = false;
        }
        return ok;
    },

    /** Test seam. */
    __set(row: ScreenRow) { rows.set(row.symbol, row); lastRun = Date.now(); },
    __reset() { rows.clear(); lastRun = 0; },
};
