/**
 * CANDLE AGGREGATION for the chart feed.
 *
 * The chart's data sources do not offer every interval the app does.
 * Yahoo has no 4-hour bar, so a 4h request has always been served with
 * 60-minute bars, and the client — believing it held 4h data — bucketed
 * them by 4 hours and kept the *first* bar of each bucket, throwing the
 * other three away. That produced a quarter of the candles, each with the
 * high, low and close of only its first hour: not merely sparse, wrong.
 * When the bucket was much wider than the data's real spacing the survivors
 * collapsed toward a single bar, which is the "chart shows one line, change
 * the timeframe until it works" symptom.
 *
 * The fix is to fold rather than drop, and to do it here so the response
 * always matches the interval that was asked for. One implementation, on
 * the side of the wire that knows what the source actually returned.
 */

export interface RawCandle {
    timestamp: Date | number | string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

export interface AggCandle {
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/** Bucket width in milliseconds for each interval the app offers. */
export const INTERVAL_MS: Record<string, number> = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
    '4h': 14_400_000,
    '1d': 86_400_000,
    '1w': 604_800_000,
};

/** True when every price is a real number. */
function usable(c: RawCandle): boolean {
    const t = new Date(c.timestamp as any).getTime();
    return Number.isFinite(t)
        && Number.isFinite(c.open) && Number.isFinite(c.high)
        && Number.isFinite(c.low) && Number.isFinite(c.close);
}

/**
 * Fold candles into `interval` buckets.
 *
 * Open comes from the first bar of the bucket, close from the last, high
 * and low from the extremes, volume from the sum — the definition of a
 * candle, rather than a sample of one. Bars already at or coarser than the
 * target interval pass through unchanged, so calling this when the source
 * already matched is free and harmless.
 *
 * A bar with a null or NaN price is dropped: Yahoo returns those for
 * illiquid minutes, and a NaN reaching the chart draws nothing at all,
 * which looks exactly like missing data with none of the honesty.
 */
export function aggregateCandles(rows: RawCandle[], interval: string): AggCandle[] {
    const width = INTERVAL_MS[interval];
    const clean = rows.filter(usable);
    if (!width || clean.length === 0) {
        return clean.map(c => ({
            timestamp: new Date(c.timestamp as any),
            open: c.open, high: c.high, low: c.low, close: c.close,
            volume: Number.isFinite(c.volume as number) ? Number(c.volume) : 0,
        }));
    }

    const sorted = clean
        .map(c => ({ ...c, ms: new Date(c.timestamp as any).getTime() }))
        .sort((a, b) => a.ms - b.ms);

    const buckets = new Map<number, AggCandle>();
    for (const c of sorted) {
        // Floor to the bucket. Every interval here divides a day evenly and
        // the epoch starts on a UTC midnight, so this aligns to real
        // session boundaries rather than to an arbitrary offset.
        const key = Math.floor(c.ms / width) * width;
        const cur = buckets.get(key);
        const vol = Number.isFinite(c.volume as number) ? Number(c.volume) : 0;
        if (!cur) {
            buckets.set(key, {
                timestamp: new Date(key),
                open: c.open, high: c.high, low: c.low, close: c.close,
                volume: vol,
            });
        } else {
            cur.high = Math.max(cur.high, c.high);
            cur.low = Math.min(cur.low, c.low);
            cur.close = c.close;      // the last bar in the bucket closes it
            cur.volume += vol;
        }
    }

    return [...buckets.values()].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * The native spacing of a series, as the median gap between bars.
 *
 * Median rather than mean because market data has weekend and holiday
 * gaps, and one three-day gap would otherwise make hourly bars look
 * daily. Returns null when there is not enough data to tell.
 */
export function nativeIntervalMs(rows: RawCandle[]): number | null {
    const times = rows
        .filter(usable)
        .map(c => new Date(c.timestamp as any).getTime())
        .sort((a, b) => a - b);
    if (times.length < 3) return null;

    const gaps: number[] = [];
    for (let i = 1; i < times.length; i++) {
        const g = times[i] - times[i - 1];
        if (g > 0) gaps.push(g);
    }
    if (!gaps.length) return null;
    gaps.sort((a, b) => a - b);
    const mid = Math.floor(gaps.length / 2);
    return gaps.length % 2 ? gaps[mid] : Math.round((gaps[mid - 1] + gaps[mid]) / 2);
}

/**
 * What the app can honestly serve for this request.
 *
 * When the source's own bars are coarser than the interval asked for —
 * daily bars for a 15-minute chart, because minute history that old does
 * not exist — aggregating cannot invent the detail. Rather than draw one
 * bar per day on a 15-minute axis and let the user think that is the
 * market, the response says which interval the data actually is.
 */
export function servedInterval(rows: RawCandle[], requested: string): string {
    const want = INTERVAL_MS[requested];
    const native = nativeIntervalMs(rows);
    if (!want || native === null) return requested;
    if (native <= want) return requested;

    // Pick the finest interval the data can actually fill.
    const order = Object.entries(INTERVAL_MS).sort((a, b) => a[1] - b[1]);
    for (const [name, ms] of order) {
        if (ms >= native) return name;
    }
    return order[order.length - 1][0];
}
