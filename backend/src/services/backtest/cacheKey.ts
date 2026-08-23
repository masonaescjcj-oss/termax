/**
 * BACKTEST CACHE KEY — "same spec + same window = same answer".
 *
 * The window is rounded to the DAY, not the millisecond: a backtest
 * requested at 10:00 and again at 10:05 asks the same question, and a
 * cache that misses on a five-minute difference is not a cache. Fresh
 * candles arriving during the day are the accepted trade-off — the same
 * one every charting platform makes when it caches a study.
 *
 * The spec is hashed canonically (sorted keys), so re-ordered JSON with
 * identical meaning still hits.
 */

import crypto from 'crypto';
import { StrategySpec } from '../strategy/types';

function canonical(value: any): any {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
        return Object.keys(value).sort().reduce((out: any, k) => {
            out[k] = canonical(value[k]);
            return out;
        }, {});
    }
    return value;
}

export function backtestCacheKey(spec: StrategySpec, fromMs: number, toMs: number, startBalance: number): string {
    const day = 86_400_000;
    const payload = JSON.stringify({
        spec: canonical(spec),
        from: Math.floor(fromMs / day),
        to: Math.floor(toMs / day),
        startBalance,
    });
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 40);
}
