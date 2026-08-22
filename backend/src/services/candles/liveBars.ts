/**
 * LIVE BAR BUILDER
 *
 * Turns the quote stream into closed bars on every timeframe. One-minute
 * bars are built from mid prices, persisted to the binary store, and fed
 * through aggregators for the higher frames; every closed bar is announced
 * to listeners (the bot runner, and later the chart stream).
 *
 * Two honesty rules:
 *  - A bar only exists where ticks existed. A minute with no quotes yields
 *    no bar — inventing flat candles would feed indicators fabricated data,
 *    which is the exact failure the engine rebuild removed.
 *  - "Volume" is the tick count. A quote feed has no traded volume; calling
 *    the field anything else would imply data we do not have.
 *
 * A sweep timer closes the forming minute once its bucket has passed even
 * if no newer quote arrives, so bots on quiet symbols are not stuck waiting
 * for the next tick to learn the previous bar closed.
 */

import { FeedQuote } from '../feeds/types';
import { BarAggregator, bucketStart } from '../strategy/series';
import { Bar, TIMEFRAMES, Timeframe } from '../strategy/types';
import { appendBars } from './store';

export type BarListener = (symbol: string, tf: Timeframe, bar: Bar) => void;

/** Higher frames derived from the 1m stream. */
const DERIVED: Timeframe[] = TIMEFRAMES.filter(tf => tf !== '1m');

interface Forming {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number; // tick count
}

class SymbolBars {
    forming: Forming | null = null;
    aggregators = new Map<Timeframe, BarAggregator>();

    constructor() {
        for (const tf of DERIVED) this.aggregators.set(tf, new BarAggregator(tf));
    }
}

export class LiveBarBuilder {
    private symbols = new Map<string, SymbolBars>();
    private listeners = new Set<BarListener>();
    private sweep: NodeJS.Timeout | null = null;
    private persist: boolean;

    constructor(opts: { persist?: boolean } = {}) {
        this.persist = opts.persist ?? true;
    }

    onBar(listener: BarListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /** Feed one quote. Closes and emits the previous minute when it rolls. */
    onQuote(q: FeedQuote): void {
        const mid = (q.bid + q.ask) / 2;
        if (!(mid > 0) || !Number.isFinite(q.ts)) return;

        let state = this.symbols.get(q.symbol);
        if (!state) {
            state = new SymbolBars();
            this.symbols.set(q.symbol, state);
        }

        const bucket = bucketStart('1m', q.ts);
        const f = state.forming;

        if (f && bucket > f.time) {
            this.closeMinute(q.symbol, state);
        } else if (f && bucket < f.time) {
            // A quote older than the forming bar (feed replay) — ignore it
            // rather than corrupting an already-open bucket.
            return;
        }

        if (!state.forming) {
            state.forming = { time: bucket, open: mid, high: mid, low: mid, close: mid, volume: 1 };
        } else {
            const cur = state.forming;
            if (mid > cur.high) cur.high = mid;
            if (mid < cur.low) cur.low = mid;
            cur.close = mid;
            cur.volume++;
        }
    }

    /** Close any forming minute whose bucket has fully passed. */
    sweepNow(now = Date.now()): void {
        for (const [symbol, state] of this.symbols) {
            const f = state.forming;
            if (f && now >= f.time + 60_000) {
                this.closeMinute(symbol, state);
            }
        }
    }

    start(sweepMs = 5_000): void {
        if (this.sweep) return;
        this.sweep = setInterval(() => this.sweepNow(), sweepMs);
        // Keep the process free to exit in tests / graceful shutdown.
        this.sweep.unref?.();
    }

    stop(): void {
        if (this.sweep) {
            clearInterval(this.sweep);
            this.sweep = null;
        }
    }

    private closeMinute(symbol: string, state: SymbolBars): void {
        const f = state.forming!;
        state.forming = null;
        const bar: Bar = { ...f };

        if (this.persist) {
            try {
                appendBars(symbol, [bar]);
            } catch (e: any) {
                console.error(`[Bars] Could not persist ${symbol} ${new Date(bar.time).toISOString()}:`, e.message);
            }
        }

        this.emit(symbol, '1m', bar);

        for (const [tf, agg] of state.aggregators) {
            const done = agg.push(bar);
            if (done) this.emit(symbol, tf, done);
        }
    }

    private emit(symbol: string, tf: Timeframe, bar: Bar): void {
        for (const l of this.listeners) {
            try {
                l(symbol, tf, bar);
            } catch (e: any) {
                console.error('[Bars] Listener threw:', e.message);
            }
        }
    }
}

/** Process-wide builder, wired to the feed router at boot. */
export const liveBars = new LiveBarBuilder();
