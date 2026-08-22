/**
 * TRADE AUTOPSY — «چرا این ضرر داد؟»
 *
 * One-tap post-mortem of a single closed trade, computed from the stored
 * candles around its entry and exit. Deterministic and free: no AI tokens
 * are burned to answer the most common question a losing trader has. The
 * AI can narrate this via a tool, but the numbers come from here.
 *
 * The verdicts it can reach:
 *  - stopped-then-reversed: the stop was hit, then price went the trade's
 *    way by >= 1R within the aftermath window (the "they hunted my stop"
 *    feeling, quantified);
 *  - tight stop: the stop distance was under half an ATR(14) at entry —
 *    inside the market's own noise;
 *  - no stop at all;
 *  - counter-trend entry: against the EMA(50) slope at entry;
 *  - costs ate it: spread+commission+swap were a large share of the loss;
 *  - left on the table: the trade saw >= 2x its final profit in open
 *    profit (MFE) but gave it back.
 */

import { getSpec } from '../../config/instruments';
import { readBarsTf } from '../candles/store';
import { Bar, TIMEFRAME_MS, Timeframe } from '../strategy/types';

export interface AutopsyTrade {
    symbol: string;
    side: 'BUY' | 'SELL';
    volume: number;
    entryPrice: number;
    closePrice: number;
    openTime: number;   // ms
    closeTime: number;  // ms
    netProfit: number;
    stopLoss?: number | null;
    takeProfit?: number | null;
    commission?: number | null;
    swap?: number | null;
}

export interface AutopsyVerdict {
    key: 'stoppedThenReversed' | 'tightStop' | 'noStop' | 'counterTrend' | 'costsAteIt' | 'gaveBackProfit' | 'cleanLossOrWin';
    fa: string;
    en: string;
    evidence: Record<string, number | string | boolean>;
}

export interface AutopsyReport {
    ok: true;
    timeframe: Timeframe;
    facts: {
        holdMinutes: number;
        pips: number;
        /** Max favorable / adverse excursion while in the trade, in pips. */
        mfePips: number;
        maePips: number;
        /** Best move in the trade's direction within the aftermath window. */
        afterExitPips: number;
        atrPipsAtEntry: number | null;
        stopPips: number | null;
        costs: number;
    };
    verdicts: AutopsyVerdict[];
    /** The candle window, for drawing the story on the client chart. */
    candles: Bar[];
    entryIndex: number;
    exitIndex: number;
}

export interface AutopsyUnavailable { ok: false; reason: string }

const AFTERMATH_BARS = 20;
const CONTEXT_BARS = 20;

/** Pick the timeframe whose bars tell this trade's story in ~30-200 bars. */
export function autopsyTimeframe(holdMs: number): Timeframe {
    if (holdMs <= 2 * 3600_000) return '1m';
    if (holdMs <= 10 * 3600_000) return '5m';
    if (holdMs <= 48 * 3600_000) return '15m';
    if (holdMs <= 14 * 86_400_000) return '1h';
    return '4h';
}

export function runAutopsy(trade: AutopsyTrade): AutopsyReport | AutopsyUnavailable {
    const spec = getSpec(trade.symbol);
    const pipSize = spec.pipSize;
    const dir = trade.side === 'BUY' ? 1 : -1;
    const holdMs = trade.closeTime - trade.openTime;
    if (!(holdMs >= 0)) return { ok: false, reason: 'The trade has inconsistent timestamps.' };

    const tf = autopsyTimeframe(holdMs);
    const tfMs = TIMEFRAME_MS[tf];
    // ATR warm-up needs history before the context window too.
    const from = trade.openTime - (CONTEXT_BARS + 60) * tfMs;
    const to = trade.closeTime + (AFTERMATH_BARS + 2) * tfMs;
    const all = readBarsTf(trade.symbol, tf, from, to);
    if (all.length < 30) {
        return { ok: false, reason: `Not enough stored ${tf} candles around this trade to reconstruct it.` };
    }

    const entryIdxAll = all.findIndex(b => b.time + tfMs > trade.openTime);
    let exitIdxAll = -1;
    for (let i = all.length - 1; i >= 0; i--) {
        if (all[i].time < trade.closeTime) { exitIdxAll = i; break; }
    }
    if (entryIdxAll === -1 || exitIdxAll === -1 || exitIdxAll < entryIdxAll) {
        return { ok: false, reason: 'The stored candles do not cover this trade\'s lifetime.' };
    }

    // ── EMA(50) slope + ATR(14) at entry, from bars BEFORE entry ────
    let emaSlope: number | null = null;
    let atrAtEntry: number | null = null;
    {
        const pre = all.slice(0, entryIdxAll);
        if (pre.length >= 55) {
            const k = 2 / 51;
            let ema = pre.slice(0, 50).reduce((s, b) => s + b.close, 0) / 50;
            let emaPrevBars: number | null = null;
            for (let i = 50; i < pre.length; i++) {
                if (i === pre.length - 3) emaPrevBars = ema;
                ema = pre[i].close * k + ema * (1 - k);
            }
            if (emaPrevBars !== null) emaSlope = ema - emaPrevBars;
        }
        if (pre.length >= 16) {
            let atr = 0;
            for (let i = pre.length - 14; i < pre.length; i++) {
                const b = pre[i];
                const prevClose = pre[i - 1].close;
                atr += Math.max(b.high - b.low, Math.abs(b.high - prevClose), Math.abs(b.low - prevClose));
            }
            atrAtEntry = atr / 14;
        }
    }

    // ── excursions while in the trade ───────────────────────────────
    let best = -Infinity;
    let worst = Infinity;
    for (let i = entryIdxAll; i <= exitIdxAll; i++) {
        const fav = dir === 1 ? all[i].high : all[i].low;
        const adv = dir === 1 ? all[i].low : all[i].high;
        const favMove = (fav - trade.entryPrice) * dir;
        const advMove = (adv - trade.entryPrice) * dir;
        if (favMove > best) best = favMove;
        if (advMove < worst) worst = advMove;
    }
    const mfePips = best / pipSize;
    const maePips = -worst / pipSize;

    // ── the aftermath: where did price go AFTER the exit? ───────────
    let afterBest = 0;
    for (let i = exitIdxAll + 1; i < Math.min(all.length, exitIdxAll + 1 + AFTERMATH_BARS); i++) {
        const fav = dir === 1 ? all[i].high : all[i].low;
        const move = (fav - trade.closePrice) * dir;
        if (move > afterBest) afterBest = move;
    }
    const afterExitPips = afterBest / pipSize;

    const pips = (trade.closePrice - trade.entryPrice) * dir / pipSize;
    const stopPips = trade.stopLoss ? Math.abs(trade.entryPrice - trade.stopLoss) / pipSize : null;
    const costs = Math.abs(trade.commission ?? 0) + Math.abs(Math.min(0, trade.swap ?? 0));
    const atrPips = atrAtEntry !== null ? atrAtEntry / pipSize : null;

    // ── verdicts ────────────────────────────────────────────────────
    const verdicts: AutopsyVerdict[] = [];
    const lost = trade.netProfit < 0;
    const money = (v: number) => `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`;

    const stoppedOut = lost && stopPips !== null
        && Math.abs((trade.closePrice - (trade.stopLoss as number)) / pipSize) <= Math.max(1, stopPips * 0.1);

    if (lost && !trade.stopLoss) {
        verdicts.push({
            key: 'noStop',
            fa: `این معامله حد ضرر نداشت و ${money(trade.netProfit)} ضرر داد. بدون حد ضرر، اندازه‌ی ضرر را بازار تعیین می‌کند، نه شما.`,
            en: `This trade had no stop loss and lost ${money(trade.netProfit)}. Without a stop, the market decides the loss size — not you.`,
            evidence: { netProfit: Number(trade.netProfit.toFixed(2)) },
        });
    }
    if (stoppedOut && afterExitPips >= (stopPips as number)) {
        verdicts.push({
            key: 'stoppedThenReversed',
            fa: `حد ضرر خورد و بعد قیمت ${afterExitPips.toFixed(0)} پیپ در جهت معامله‌ی شما رفت (حد ضرر ${stopPips!.toFixed(0)} پیپ بود). جهت درست بود، جای حد ضرر نه.`,
            en: `The stop was hit, then price moved ${afterExitPips.toFixed(0)} pips in your direction (the stop was ${stopPips!.toFixed(0)} pips). The direction was right; the stop placement was not.`,
            evidence: { afterExitPips: Number(afterExitPips.toFixed(1)), stopPips: Number(stopPips!.toFixed(1)) },
        });
    }
    if (lost && stopPips !== null && atrPips !== null && stopPips < atrPips * 0.5) {
        verdicts.push({
            key: 'tightStop',
            fa: `حد ضرر ${stopPips.toFixed(0)} پیپ بود، ولی نوسان معمول بازار (ATR14) در لحظه‌ی ورود ${atrPips.toFixed(0)} پیپ — حد ضرر داخل نویزِ خود بازار بود.`,
            en: `The stop was ${stopPips.toFixed(0)} pips, but the market's own noise at entry (ATR14) was ${atrPips.toFixed(0)} pips — the stop sat inside the noise.`,
            evidence: { stopPips: Number(stopPips.toFixed(1)), atrPips: Number(atrPips.toFixed(1)) },
        });
    }
    if (lost && emaSlope !== null && emaSlope * dir < 0 && Math.abs(emaSlope) > pipSize) {
        verdicts.push({
            key: 'counterTrend',
            fa: `ورود خلاف روند بود: شیب EMA(50) در تایم‌فریم ${tf} هنگام ورود ${emaSlope > 0 ? 'صعودی' : 'نزولی'} بود و شما ${trade.side === 'BUY' ? 'خریدید' : 'فروختید'}.`,
            en: `The entry was counter-trend: the EMA(50) slope on ${tf} was ${emaSlope > 0 ? 'up' : 'down'} at entry and you went ${trade.side}.`,
            evidence: { emaSlopePips: Number((emaSlope / pipSize).toFixed(1)), side: trade.side },
        });
    }
    if (lost && costs > 0 && Math.abs(trade.netProfit) > 0 && costs / Math.abs(trade.netProfit) >= 0.4) {
        verdicts.push({
            key: 'costsAteIt',
            fa: `${money(costs)} از این ضرر فقط هزینه بود (کمیسیون و سواپ) — ${(costs / Math.abs(trade.netProfit) * 100).toFixed(0)}٪ کل ضرر.`,
            en: `${money(costs)} of this loss was pure cost (commission + swap) — ${(costs / Math.abs(trade.netProfit) * 100).toFixed(0)}% of the total.`,
            evidence: { costs: Number(costs.toFixed(2)), share: Number((costs / Math.abs(trade.netProfit)).toFixed(2)) },
        });
    }
    if (mfePips > 0 && pips < mfePips * 0.4 && mfePips >= 5) {
        verdicts.push({
            key: 'gaveBackProfit',
            fa: `این معامله تا ${mfePips.toFixed(0)} پیپ در سود بود و در ${pips.toFixed(0)} پیپ بسته شد — ${(mfePips - Math.max(0, pips)).toFixed(0)} پیپ سود شناور پس داده شد.`,
            en: `The trade was up ${mfePips.toFixed(0)} pips at its best and closed at ${pips.toFixed(0)} — ${(mfePips - Math.max(0, pips)).toFixed(0)} pips of open profit were given back.`,
            evidence: { mfePips: Number(mfePips.toFixed(1)), closedPips: Number(pips.toFixed(1)) },
        });
    }
    if (!verdicts.length) {
        verdicts.push({
            key: 'cleanLossOrWin',
            fa: lost
                ? 'ضرر تمیز: حد ضرر منطقی بود، قیمت هم بعدش برنگشت. این هزینه‌ی عادی استراتژی است، نه اشتباه.'
                : 'معامله‌ی تمیز: چیزی برای کالبدشکافی پیدا نشد.',
            en: lost
                ? 'A clean loss: the stop was reasonable and price did not reverse after it. This is the normal cost of trading, not a mistake.'
                : 'A clean trade: nothing to dissect.',
            evidence: { lost },
        });
    }

    // Trim the candle window we ship to the client.
    const fromIdx = Math.max(0, entryIdxAll - CONTEXT_BARS);
    const toIdx = Math.min(all.length, exitIdxAll + 1 + AFTERMATH_BARS);
    return {
        ok: true,
        timeframe: tf,
        facts: {
            holdMinutes: Number((holdMs / 60_000).toFixed(1)),
            pips: Number(pips.toFixed(1)),
            mfePips: Number(mfePips.toFixed(1)),
            maePips: Number(maePips.toFixed(1)),
            afterExitPips: Number(afterExitPips.toFixed(1)),
            atrPipsAtEntry: atrPips !== null ? Number(atrPips.toFixed(1)) : null,
            stopPips: stopPips !== null ? Number(stopPips.toFixed(1)) : null,
            costs: Number(costs.toFixed(2)),
        },
        verdicts,
        candles: all.slice(fromIdx, toIdx),
        entryIndex: entryIdxAll - fromIdx,
        exitIndex: exitIdxAll - fromIdx,
    };
}
