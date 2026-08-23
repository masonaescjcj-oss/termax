/**
 * SETUP SCANNER — «الان کدام نمادها ستاپ من را دارند؟»
 *
 * Takes a strategy spec and runs its ENTRY logic across many symbols on
 * the same timeframe, reporting where the conditions hold right now (or
 * held within the last few closed bars). One strategy, the whole market.
 *
 * Two honesty decisions:
 *  - Limits are stripped from the scanned clone. A daily trade cap or a
 *    cooldown answers "would my bot have traded?", but the scanner asks
 *    "does the setup exist?" — suppressing a real signal because the bot
 *    already traded today would be a lie about the market.
 *  - Only CLOSED bars are evaluated, exactly like the live runner. A
 *    forming candle can un-trigger, and a scanner that flickers is worse
 *    than no scanner.
 */

import { getSpec } from '../../config/instruments';
import { readBarsTf } from '../candles/store';
import { feedRouter } from '../feeds';
import { getSpreadPips } from '../pricing';
import { compileStrategy } from '../strategy/interpreter';
import { Bar, StrategySpec, TIMEFRAME_MS, initialBotState } from '../strategy/types';

/** How far back a signal still counts as "current". */
export const SCAN_LOOKBACK_BARS = 3;
const MIN_BARS = 60;
const LOAD_BARS = 320;
export const MAX_SCAN_SYMBOLS = 30;

export interface ScanHit {
    symbol: string;
    side: 'BUY' | 'SELL';
    /** 0 = the bar that just closed. */
    barsAgo: number;
    barTime: number;
    close: number;
    stopLoss: number;
    takeProfit: number | null;
    spreadPips: number | null;
    reason: string;
}

export interface ScanResult {
    timeframe: string;
    hits: ScanHit[];
    scanned: string[];
    /** symbol -> why it could not be scanned. */
    skipped: Record<string, string>;
}

/** Load closed bars for one symbol: the store first, the feeds second. */
async function loadBars(symbol: string, timeframe: any): Promise<Bar[]> {
    const now = Date.now();
    const span = TIMEFRAME_MS[timeframe as keyof typeof TIMEFRAME_MS] ?? 3_600_000;
    let bars = readBarsTf(symbol, timeframe, now - LOAD_BARS * span * 3, now);
    if (bars.length < MIN_BARS) {
        const fetched = await feedRouter.getCandles(symbol, timeframe, LOAD_BARS);
        if (fetched?.length) {
            bars = fetched.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
        }
    }
    return bars.slice(-LOAD_BARS);
}

/**
 * Run one spec's entry logic over each symbol. The spec's own symbol is
 * included automatically; unknown or unpriced symbols are reported in
 * `skipped` rather than silently dropped.
 */
export async function scanSpec(spec: StrategySpec, symbols: string[]): Promise<ScanResult> {
    const wanted = Array.from(new Set([spec.symbol, ...symbols]))
        .filter(s => typeof s === 'string' && s.trim())
        .slice(0, MAX_SCAN_SYMBOLS);

    const hits: ScanHit[] = [];
    const scanned: string[] = [];
    const skipped: Record<string, string> = {};

    for (const symbol of wanted) {
        // A spec built for EUR/USD scanned on GOLD must use GOLD's pip
        // size and digits — the interpreter reads those from the spec's
        // symbol, so the clone carries the scanned symbol.
        let clone: StrategySpec;
        try {
            getSpec(symbol);
            clone = { ...JSON.parse(JSON.stringify(spec)), symbol };
            delete (clone as any).limits;
        } catch (e: any) {
            skipped[symbol] = e?.message ?? 'unknown instrument';
            continue;
        }

        let compiled;
        try {
            compiled = compileStrategy(clone);
        } catch (e: any) {
            skipped[symbol] = `spec does not compile for this symbol: ${e.message}`;
            continue;
        }

        const bars = await loadBars(symbol, spec.timeframe);
        if (bars.length < MIN_BARS) {
            skipped[symbol] = `only ${bars.length} candles available`;
            continue;
        }

        const spreadPips = getSpreadPips(symbol) ?? undefined;
        let state = initialBotState();
        let latest: { side: 'BUY' | 'SELL'; index: number; bar: Bar; sl: number; tp: number | null; reason: string } | null = null;

        for (let i = 0; i < bars.length; i++) {
            const bar = bars[i];
            const out = compiled.onBar(spec.timeframe, bar, state, { position: null, spreadPips });
            state = out.state;
            const enter = out.decision.enter;
            if (enter) {
                latest = {
                    side: enter.side, index: i, bar,
                    sl: enter.stopLossPrice, tp: enter.takeProfitPrice,
                    reason: enter.reason,
                };
            }
        }

        scanned.push(symbol);
        if (latest) {
            const barsAgo = bars.length - 1 - latest.index;
            if (barsAgo <= SCAN_LOOKBACK_BARS) {
                hits.push({
                    symbol,
                    side: latest.side,
                    barsAgo,
                    barTime: latest.bar.time,
                    close: latest.bar.close,
                    stopLoss: latest.sl,
                    takeProfit: latest.tp,
                    spreadPips: spreadPips ?? null,
                    reason: latest.reason,
                });
            }
        }
    }

    // Freshest first; same freshness keeps the requested order.
    hits.sort((a, b) => a.barsAgo - b.barsAgo);
    return { timeframe: spec.timeframe, hits, scanned, skipped };
}
