/**
 * BAR SERIES + TIMEFRAME AGGREGATION
 *
 * Bars live in Float64Array rings rather than arrays of objects. The point is
 * not just the 4-5x memory saving — it is that the tick/bar loop allocates
 * nothing, so the garbage collector has no reason to pause it. On a small
 * server, GC pauses inside the loop that fires stop losses are the failure
 * mode to design out, not to tune later.
 */

import { Ring } from './indicators';
import { Bar, TIMEFRAME_MS, Timeframe } from './types';

const DAY_MS = 86_400_000;

/**
 * Start of the bucket a timestamp falls in. Intraday frames align to the
 * epoch; '1d' aligns to UTC midnight (the same thing); '1w' aligns to Monday
 * 00:00 UTC — the forex week, not the epoch's Thursday.
 */
export function bucketStart(tf: Timeframe, time: number): number {
    if (tf === '1w') {
        const days = Math.floor(time / DAY_MS);
        const dowFromMonday = (days + 3) % 7; // 1970-01-01 was a Thursday
        return (days - dowFromMonday) * DAY_MS;
    }
    const ms = TIMEFRAME_MS[tf];
    return Math.floor(time / ms) * ms;
}

/** Rolling window of closed bars for one (symbol, timeframe). */
export class BarSeries {
    private t: Ring;
    private o: Ring;
    private h: Ring;
    private l: Ring;
    private c: Ring;
    private v: Ring;

    constructor(readonly timeframe: Timeframe, capacity = 600) {
        this.t = new Ring(capacity);
        this.o = new Ring(capacity);
        this.h = new Ring(capacity);
        this.l = new Ring(capacity);
        this.c = new Ring(capacity);
        this.v = new Ring(capacity);
    }

    push(bar: Bar): void {
        this.t.push(bar.time);
        this.o.push(bar.open);
        this.h.push(bar.high);
        this.l.push(bar.low);
        this.c.push(bar.close);
        this.v.push(bar.volume);
    }

    get length(): number { return this.t.length; }

    /** i bars back from the latest closed bar (0 = latest). */
    bar(i: number): Bar | null {
        if (i < 0 || i >= this.t.length) return null;
        return {
            time: this.t.get(i),
            open: this.o.get(i),
            high: this.h.get(i),
            low: this.l.get(i),
            close: this.c.get(i),
            volume: this.v.get(i),
        };
    }
}

/**
 * Builds closed bars of a higher timeframe from a stream of closed lower
 * timeframe bars (fed in time order). A target bar is emitted when the first
 * source bar of the NEXT bucket arrives — i.e. only once it is truly closed.
 */
export class BarAggregator {
    private acc: Bar | null = null;

    constructor(readonly target: Timeframe) {}

    /** Feed one closed source bar; returns a completed target bar, or null. */
    push(bar: Bar): Bar | null {
        const bucket = bucketStart(this.target, bar.time);
        let completed: Bar | null = null;

        if (this.acc && this.acc.time !== bucket) {
            completed = this.acc;
            this.acc = null;
        }

        if (!this.acc) {
            this.acc = {
                time: bucket,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: bar.volume,
            };
        } else {
            if (bar.high > this.acc.high) this.acc.high = bar.high;
            if (bar.low < this.acc.low) this.acc.low = bar.low;
            this.acc.close = bar.close;
            this.acc.volume += bar.volume;
        }

        return completed;
    }

    /**
     * Hand back the partial bucket (backtest end / shutdown). It has not
     * closed, so callers must treat it as forming — never evaluate on it.
     */
    flush(): Bar | null {
        const out = this.acc;
        this.acc = null;
        return out;
    }
}
