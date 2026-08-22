/**
 * CANDLE BACKFILL
 *
 * Fills the binary store with historical 1m bars from whichever feed has
 * real history for a symbol (Binance klines for crypto, cTrader trendbars
 * for forex/metals/indices). Pages forward through the window; empty pages
 * (weekends, market holidays) advance the cursor instead of aborting, and
 * the store's own dedup makes overlapping runs harmless.
 *
 * Sized for a small server: pages are sequential with a breather between
 * them (cTrader's historical budget is 5 req/s shared with charts), and a
 * hard page cap bounds any one call.
 */

import { feedRouter } from '../feeds';
import { Bar } from '../strategy/types';
import { appendBars, lastStoredTime, readBars } from './store';

const PAGE_MS = 1000 * 60_000;        // 1000 one-minute bars per page
const PAGE_PAUSE_MS = 300;            // breathing room between pages
const MAX_PAGES_PER_CALL = 600;       // ≈ 14 months of 1m data, upper bound
export const MAX_BACKFILL_DAYS = 400;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface BackfillOutcome {
    symbol: string;
    requestedFrom: number;
    requestedTo: number;
    barsWritten: number;
    pages: number;
    /** True when no feed could serve any history for the symbol. */
    noSource: boolean;
}

/**
 * Ensure the store holds 1m bars for [fromMs, toMs). Fetches only what is
 * missing after the last stored bar; a fully-covered window is a no-op.
 */
export async function backfillRange(symbol: string, fromMs: number, toMs: number): Promise<BackfillOutcome> {
    const now = Date.now();
    const to = Math.min(toMs, now);
    const from = Math.max(fromMs, now - MAX_BACKFILL_DAYS * 86_400_000);

    // Start after what we already have — the store is append-only.
    const stored = lastStoredTime(symbol);
    let cursor = Number.isFinite(stored) ? Math.max(from, stored + 60_000) : from;

    const outcome: BackfillOutcome = {
        symbol, requestedFrom: from, requestedTo: to,
        barsWritten: 0, pages: 0, noSource: false,
    };
    if (cursor >= to) return outcome;

    let sawAnyData = false;
    while (cursor < to && outcome.pages < MAX_PAGES_PER_CALL) {
        const pageEnd = Math.min(cursor + PAGE_MS, to);
        const candles = await feedRouter.getCandlesRange(symbol, '1m', cursor, pageEnd);
        outcome.pages++;

        if (candles === null && !sawAnyData) {
            // No feed has history for this symbol at all — stop immediately
            // rather than paging through the whole window for nothing.
            outcome.noSource = true;
            return outcome;
        }
        if (candles && candles.length) {
            sawAnyData = true;
            const bars: Bar[] = candles
                .filter(c => c.time >= cursor && c.time < pageEnd)
                .map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
            outcome.barsWritten += appendBars(symbol, bars);
        }
        // Advance past the page even when it was empty (weekend/holiday).
        cursor = pageEnd;
        if (cursor < to) await sleep(PAGE_PAUSE_MS);
    }
    return outcome;
}

/**
 * How much of [fromMs, toMs) the store actually covers, as a fraction of the
 * expected bar count. Forex trades ~5/7 of the week, so 0.6 of the naive
 * minute count is already "full" — callers should treat >= 0.5 as usable.
 */
export function coverage(symbol: string, fromMs: number, toMs: number): number {
    const expected = Math.max(1, Math.floor((toMs - fromMs) / 60_000));
    const have = readBars(symbol, fromMs, toMs).length;
    return have / expected;
}
