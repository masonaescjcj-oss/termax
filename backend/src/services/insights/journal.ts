/**
 * AUTO JOURNAL — the market context each trade was taken in.
 *
 * "Your worst hour is 15:00 UTC" is useful. "You lose in high-volatility
 * ranges and win in quiet trends" is actionable — but only if every
 * trade carries the regime it happened in. This module classifies that
 * regime from the candles around the entry, deterministically:
 *
 *   trend      — direction and strength from the EMA(50) slope measured
 *                in ATR units, so it means the same thing on gold and on
 *                EUR/USD
 *   volatility — the entry ATR against its own 100-bar median: the
 *                market compared to its own normal, not an absolute
 *   session    — which trading session the entry fell in (UTC)
 *   withTrend  — did the trade side agree with the regime?
 *
 * Nothing here is a prediction. Every tag is a measurement of the past,
 * which is why it can be trusted as DNA input.
 */

import { getSpec } from '../../config/instruments';
import { readBarsTf } from '../candles/store';
import { Bar, SESSION_HOURS_UTC, SessionName, TIMEFRAME_MS, Timeframe } from '../strategy/types';

export type TrendTag = 'UP' | 'DOWN' | 'RANGE';
export type VolTag = 'QUIET' | 'NORMAL' | 'WILD';

export interface JournalTags {
    trend: TrendTag;
    volatility: VolTag;
    session: SessionName | 'offHours';
    /** True when a BUY happened in an UP regime (or a SELL in DOWN). */
    withTrend: boolean | null;
    evidence: {
        emaSlopeAtr: number | null;
        atrPips: number | null;
        atrRatio: number | null;
        hourUtc: number;
        timeframe: Timeframe;
        bars: number;
    };
}

/** The timeframe whose bars describe the context of a trade this long. */
export function contextTimeframe(holdMs: number): Timeframe {
    if (holdMs <= 2 * 3600_000) return '5m';
    if (holdMs <= 12 * 3600_000) return '15m';
    if (holdMs <= 3 * 86_400_000) return '1h';
    return '4h';
}

const SLOPE_TREND = 0.35;   // EMA(50) change over 5 bars, in ATR units
const VOL_QUIET = 0.7;
const VOL_WILD = 1.5;

function median(xs: number[]): number {
    if (!xs.length) return NaN;
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function sessionOf(hourUtc: number): SessionName | 'offHours' {
    // Overlaps are real; the first match in this order wins, which puts
    // the deepest-liquidity session first.
    const order: SessionName[] = ['london', 'newyork', 'tokyo', 'sydney'];
    for (const name of order) {
        const [from, to] = SESSION_HOURS_UTC[name];
        const inside = from <= to ? hourUtc >= from && hourUtc < to : hourUtc >= from || hourUtc < to;
        if (inside) return name;
    }
    return 'offHours';
}

/**
 * Classify one trade's context. `bars` may be supplied (tests, batch
 * runs); otherwise the stored candles around the entry are used.
 */
export function classifyContext(
    trade: { symbol: string; side: 'BUY' | 'SELL'; openTime: number; closeTime: number },
    bars?: Bar[]
): JournalTags {
    const tf = contextTimeframe(trade.closeTime - trade.openTime);
    const tfMs = TIMEFRAME_MS[tf];
    const hourUtc = new Date(trade.openTime).getUTCHours();
    const spec = getSpec(trade.symbol);

    const window = bars ?? readBarsTf(trade.symbol, tf, trade.openTime - 160 * tfMs, trade.openTime);
    // Only bars strictly before the entry: context, never hindsight.
    const pre = window.filter(b => b.time < trade.openTime);

    const base: JournalTags = {
        trend: 'RANGE', volatility: 'NORMAL', session: sessionOf(hourUtc), withTrend: null,
        evidence: { emaSlopeAtr: null, atrPips: null, atrRatio: null, hourUtc, timeframe: tf, bars: pre.length },
    };
    if (pre.length < 60) return base;

    // ATR(14) series, so "wild" can be judged against this market's own normal.
    const atrs: number[] = [];
    let atr = NaN;
    for (let i = 1; i < pre.length; i++) {
        const b = pre[i];
        const prevClose = pre[i - 1].close;
        const tr = Math.max(b.high - b.low, Math.abs(b.high - prevClose), Math.abs(b.low - prevClose));
        atr = Number.isFinite(atr) ? (atr * 13 + tr) / 14 : tr;
        if (i >= 14) atrs.push(atr);
    }
    const atrNow = atrs[atrs.length - 1];
    const atrMedian = median(atrs.slice(-100));
    const atrRatio = atrMedian > 0 ? atrNow / atrMedian : NaN;

    // EMA(50) slope over the last 5 bars, expressed in ATR units.
    const k = 2 / 51;
    let ema = pre.slice(0, 50).reduce((s, b) => s + b.close, 0) / 50;
    let emaFiveAgo = NaN;
    for (let i = 50; i < pre.length; i++) {
        if (i === pre.length - 5) emaFiveAgo = ema;
        ema = pre[i].close * k + ema * (1 - k);
    }
    const slopeAtr = Number.isFinite(emaFiveAgo) && atrNow > 0 ? (ema - emaFiveAgo) / atrNow : NaN;

    const trend: TrendTag = !Number.isFinite(slopeAtr) ? 'RANGE'
        : slopeAtr >= SLOPE_TREND ? 'UP'
        : slopeAtr <= -SLOPE_TREND ? 'DOWN'
        : 'RANGE';

    const volatility: VolTag = !Number.isFinite(atrRatio) ? 'NORMAL'
        : atrRatio <= VOL_QUIET ? 'QUIET'
        : atrRatio >= VOL_WILD ? 'WILD'
        : 'NORMAL';

    return {
        trend, volatility, session: sessionOf(hourUtc),
        withTrend: trend === 'RANGE' ? null : (trade.side === 'BUY' ? trend === 'UP' : trend === 'DOWN'),
        evidence: {
            emaSlopeAtr: Number.isFinite(slopeAtr) ? Number(slopeAtr.toFixed(3)) : null,
            atrPips: Number.isFinite(atrNow) ? Number((atrNow / spec.pipSize).toFixed(1)) : null,
            atrRatio: Number.isFinite(atrRatio) ? Number(atrRatio.toFixed(2)) : null,
            hourUtc, timeframe: tf, bars: pre.length,
        },
    };
}

// ── slicing a record by context ─────────────────────────────────────

export interface JournalSlice {
    key: string;
    labelFa: string;
    labelEn: string;
    trades: number;
    wins: number;
    winRate: number;
    netProfit: number;
    expectancy: number;
}

const TREND_FA: Record<TrendTag, string> = { UP: 'روند صعودی', DOWN: 'روند نزولی', RANGE: 'بازار رِنج' };
const VOL_FA: Record<VolTag, string> = { QUIET: 'نوسان کم', NORMAL: 'نوسان معمولی', WILD: 'نوسان بالا' };
const SESSION_FA: Record<string, string> = { london: 'سشن لندن', newyork: 'سشن نیویورک', tokyo: 'سشن توکیو', sydney: 'سشن سیدنی', offHours: 'خارج از سشن‌ها' };

/**
 * Group tagged trades and report each bucket's record. Buckets under
 * `minTrades` are dropped: a 100% win rate over two trades is noise
 * dressed as insight.
 */
export function sliceByContext(
    tagged: Array<{ tags: JournalTags; netProfit: number }>,
    minTrades = 4
): { trend: JournalSlice[]; volatility: JournalSlice[]; session: JournalSlice[]; withTrend: JournalSlice[] } {
    const bucket = (
        keyOf: (t: JournalTags) => string | null,
        labelFa: (k: string) => string,
        labelEn: (k: string) => string
    ): JournalSlice[] => {
        const map = new Map<string, { trades: number; wins: number; net: number }>();
        for (const row of tagged) {
            const k = keyOf(row.tags);
            if (k === null) continue;
            const cur = map.get(k) ?? { trades: 0, wins: 0, net: 0 };
            cur.trades++;
            if (row.netProfit > 0) cur.wins++;
            cur.net += row.netProfit;
            map.set(k, cur);
        }
        return [...map.entries()]
            .filter(([, v]) => v.trades >= minTrades)
            .map(([k, v]) => ({
                key: k,
                labelFa: labelFa(k),
                labelEn: labelEn(k),
                trades: v.trades,
                wins: v.wins,
                winRate: Number(((v.wins / v.trades) * 100).toFixed(1)),
                netProfit: Number(v.net.toFixed(2)),
                expectancy: Number((v.net / v.trades).toFixed(2)),
            }))
            .sort((a, b) => b.netProfit - a.netProfit);
    };

    return {
        trend: bucket(t => t.trend, k => TREND_FA[k as TrendTag] ?? k, k => k),
        volatility: bucket(t => t.volatility, k => VOL_FA[k as VolTag] ?? k, k => k),
        session: bucket(t => t.session, k => SESSION_FA[k] ?? k, k => k),
        withTrend: bucket(
            t => t.withTrend === null ? null : (t.withTrend ? 'with' : 'against'),
            k => k === 'with' ? 'هم‌جهت با روند' : 'خلاف روند',
            k => k === 'with' ? 'with the trend' : 'against the trend',
        ),
    };
}
