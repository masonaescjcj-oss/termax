/**
 * BACKTEST ENGINE
 *
 * Runs a compiled StrategySpec over historical 1-minute bars, exactly the way
 * the live path runs it: the same interpreter decides on closed bars of the
 * spec's timeframe, and the engine plays the role the execution engine plays
 * live — SL/TP/trailing checked at 1m resolution (the closest thing history
 * has to ticks), fills on the correct side of a reconstructed bid/ask book,
 * spread paid on both legs, commission per lot, swap for every rollover held
 * through, Wednesday triple included.
 *
 * Honesty rules baked in:
 *  - Candles are mid prices, so bid/ask is reconstructed from the instrument's
 *    typical spread — never zero. Overridable, never removable.
 *  - When SL and TP are both inside one bar's range, the STOP fills. History
 *    doesn't say which printed first; the backtest must not guess in the
 *    strategy's favour.
 *  - Entries fill on the signal bar's close (the live runner sends a market
 *    order right after bar close), never inside the signal bar.
 *  - Currency conversion for non-USD-quoted instruments uses the pair's own
 *    series when it can (USD/JPY: quote→USD = 1/price); anything static is
 *    reported in `warnings` so a result can't silently overstate precision.
 *
 * The engine is pure and synchronous: no I/O, no globals, no Date.now(). The
 * worker thread wraps it; tests call it directly.
 */

import { getSpec, normaliseVolume } from '../../config/instruments';
import { compileStrategy } from '../strategy/interpreter';
import {
    Bar, BotState, EntryDecision, StrategySpec, TIMEFRAME_MS, Timeframe,
    initialBotState,
} from '../strategy/types';
import { BarAggregator } from '../strategy/series';

const ACCOUNT_CCY = 'USD';
const ROLLOVER_HOUR_UTC = 21; // matches the live engine's accrueOvernightSwap
const MAX_EQUITY_POINTS = 500;

export interface BacktestOptions {
    startBalance?: number;
    /** Override the instrument's typical spread (pips). Cannot go below 0. */
    spreadPips?: number;
    /**
     * Static conversion rates ccy→USD for instruments the series itself
     * cannot convert (e.g. GBP for EUR/GBP). Using one adds a warning.
     */
    conversionRates?: Record<string, number>;
}

export type ExitReason = 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP' | 'SIGNAL' | 'TIME_STOP' | 'END_OF_DATA';

export interface BacktestTrade {
    side: 'BUY' | 'SELL';
    volume: number;
    entryTime: number;
    /** Executed prices — entry includes the spread's half on the fill side. */
    entryPrice: number;
    exitTime: number;
    exitPrice: number;
    exitReason: ExitReason;
    pips: number;
    grossProfit: number;
    commission: number;
    swap: number;
    netProfit: number;
    balanceAfter: number;
}

export interface EquityPoint { time: number; equity: number }

export interface BacktestStats {
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    netProfit: number;
    returnPct: number;
    grossProfit: number;
    grossLoss: number;
    profitFactor: number | null;
    expectancy: number;
    maxDrawdown: number;
    maxDrawdownPct: number;
    avgWin: number;
    avgLoss: number;
    totalCommission: number;
    totalSwap: number;
    /** What the reconstructed spread cost across all round turns. */
    totalSpreadCost: number;
    barsProcessed: number;
    from: number;
    to: number;
}

export interface BacktestResult {
    symbol: string;
    timeframe: Timeframe;
    startBalance: number;
    endBalance: number;
    stats: BacktestStats;
    trades: BacktestTrade[];
    equityCurve: EquityPoint[];
    warnings: string[];
}

interface OpenPosition {
    side: 'BUY' | 'SELL';
    volume: number;
    entryTime: number;
    entryExec: number;
    stopLoss: number;
    takeProfit: number | null;
    trailingDistance: number | null;
    /** True once the trailing logic has moved the stop — labels the exit. */
    trailed: boolean;
    swapAccrued: number;
    lastRolloverKey: string;
}

const rolloverKeyOf = (ms: number): string => {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
};

export function runBacktest(spec: StrategySpec, bars1m: Bar[], opts: BacktestOptions = {}): BacktestResult {
    const compiled = compileStrategy(spec);
    const inst = getSpec(spec.symbol);
    const startBalance = opts.startBalance ?? 10_000;
    const spreadPips = Math.max(0, opts.spreadPips ?? inst.typicalSpreadPips);
    const half = (spreadPips * inst.pipSize) / 2;
    const warnings: string[] = [];

    // ── currency conversion ─────────────────────────────────────────
    // quote→account for P/L. Exact when the pair itself contains USD;
    // static (and flagged) otherwise.
    let staticQuoteRate: number | null = null;
    if (inst.quote !== ACCOUNT_CCY && inst.base !== ACCOUNT_CCY) {
        staticQuoteRate = opts.conversionRates?.[inst.quote] ?? null;
        if (staticQuoteRate === null) {
            staticQuoteRate = 1;
            warnings.push(`No ${inst.quote}→${ACCOUNT_CCY} rate supplied; P/L treated 1:1 — figures for ${spec.symbol} are approximate.`);
        } else {
            warnings.push(`${inst.quote}→${ACCOUNT_CCY} conversion uses a fixed rate for the whole test, not the historical one.`);
        }
    }
    const quoteRate = (mid: number): number => {
        if (inst.quote === ACCOUNT_CCY) return 1;
        if (inst.base === ACCOUNT_CCY) return 1 / mid; // e.g. USD/JPY: JPY→USD
        return staticQuoteRate!;
    };
    const baseRate = (mid: number): number => {
        if (inst.base === ACCOUNT_CCY) return 1;
        if (inst.quote === ACCOUNT_CCY) return mid;    // e.g. EUR/USD: EUR→USD
        return staticQuoteRate! * mid;                  // base→quote→account
    };

    // ── run state ───────────────────────────────────────────────────
    let botState: BotState = initialBotState();
    let balance = startBalance;
    let position: OpenPosition | null = null;
    const trades: BacktestTrade[] = [];
    const equityCurve: EquityPoint[] = [];
    let peakEquity = startBalance;
    let maxDrawdown = 0;
    let maxDrawdownPct = 0;
    let totalSpreadCost = 0;
    let sizingSkips = 0;

    const aggregators = new Map<Timeframe, BarAggregator>();
    for (const tf of compiled.timeframes) {
        if (tf !== '1m') aggregators.set(tf, new BarAggregator(tf));
    }

    const closeAt = (exec: number, time: number, reason: ExitReason, refMid: number) => {
        const p = position!;
        const dir = p.side === 'BUY' ? 1 : -1;
        const qr = quoteRate(refMid);
        const gross = (exec - p.entryExec) * dir * inst.contractSize * p.volume * qr;
        const commission = inst.commissionPerLot * p.volume;
        const net = gross - commission + p.swapAccrued;
        balance += net;
        totalSpreadCost += spreadPips * inst.pipSize * inst.contractSize * p.volume * qr;
        trades.push({
            side: p.side, volume: p.volume,
            entryTime: p.entryTime, entryPrice: p.entryExec,
            exitTime: time, exitPrice: exec, exitReason: reason,
            pips: ((exec - p.entryExec) * dir) / inst.pipSize,
            grossProfit: gross, commission, swap: p.swapAccrued,
            netProfit: net, balanceAfter: balance,
        });
        position = null;
    };

    const tryOpen = (enter: EntryDecision, bar: Bar) => {
        const dir = enter.side === 'BUY' ? 1 : -1;
        const entryExec = bar.close + dir * half;

        let volume: number;
        if ('fixedLots' in enter.sizing) {
            volume = normaliseVolume(spec.symbol, enter.sizing.fixedLots);
        } else {
            const distPips = Math.abs(entryExec - enter.stopLossPrice) / inst.pipSize;
            if (!(distPips > 0)) { sizingSkips++; return; }
            const pipValuePerLot = inst.pipSize * inst.contractSize * quoteRate(bar.close);
            const equityNow = balance; // flat here by construction
            const lots = (equityNow * enter.sizing.riskPercent / 100) / (distPips * pipValuePerLot);
            volume = normaliseVolume(spec.symbol, lots);
        }
        if (!(volume >= inst.minVolume)) { sizingSkips++; return; }

        position = {
            side: enter.side, volume,
            entryTime: bar.time + TIMEFRAME_MS['1m'],
            entryExec,
            stopLoss: enter.stopLossPrice,
            takeProfit: enter.takeProfitPrice,
            trailingDistance: enter.trailingDistance,
            trailed: false,
            swapAccrued: 0,
            // A position opened before today's rollover pays tonight; one
            // opened during/after the rollover hour first pays tomorrow.
            lastRolloverKey: new Date(bar.time).getUTCHours() >= ROLLOVER_HOUR_UTC
                ? rolloverKeyOf(bar.time)
                : rolloverKeyOf(bar.time - 86_400_000),
        };
    };

    // ── main loop over 1m bars ──────────────────────────────────────
    let processed = 0;
    let firstTime = 0;
    let lastBar: Bar | null = null;

    for (const bar of bars1m) {
        if (!firstTime) firstTime = bar.time;
        processed++;
        lastBar = bar;
        const barCloseTime = bar.time + TIMEFRAME_MS['1m'];

        // 1) The execution engine's job: SL/TP/trailing on this minute's range.
        if (position) {
            const p: OpenPosition = position;

            // Swap: charge once per rollover the position lives through.
            const d = new Date(bar.time);
            if (d.getUTCHours() === ROLLOVER_HOUR_UTC) {
                const key = rolloverKeyOf(bar.time);
                if (key !== p.lastRolloverKey) {
                    p.lastRolloverKey = key;
                    const rate = p.side === 'BUY' ? inst.swapLongRate : inst.swapShortRate;
                    const notional = inst.contractSize * p.volume * baseRate(bar.close);
                    const mult = d.getUTCDay() === 3 ? 3 : 1;
                    p.swapAccrued += (notional * rate / 365) * mult;
                }
            }

            if (p.side === 'BUY') {
                const bidLow = bar.low - half;
                const bidHigh = bar.high - half;
                if (bidLow <= p.stopLoss) {
                    closeAt(p.stopLoss, barCloseTime, p.trailed ? 'TRAILING_STOP' : 'STOP_LOSS', bar.close);
                } else if (p.takeProfit !== null && bidHigh >= p.takeProfit) {
                    closeAt(p.takeProfit, barCloseTime, 'TAKE_PROFIT', bar.close);
                } else if (p.trailingDistance !== null) {
                    const candidate = (bar.close - half) - p.trailingDistance;
                    if (candidate > p.stopLoss) { p.stopLoss = candidate; p.trailed = true; }
                }
            } else {
                const askHigh = bar.high + half;
                const askLow = bar.low + half;
                if (askHigh >= p.stopLoss) {
                    closeAt(p.stopLoss, barCloseTime, p.trailed ? 'TRAILING_STOP' : 'STOP_LOSS', bar.close);
                } else if (p.takeProfit !== null && askLow <= p.takeProfit) {
                    closeAt(p.takeProfit, barCloseTime, 'TAKE_PROFIT', bar.close);
                } else if (p.trailingDistance !== null) {
                    const candidate = (bar.close + half) + p.trailingDistance;
                    if (candidate < p.stopLoss) { p.stopLoss = candidate; p.trailed = true; }
                }
            }
        }

        // 2) The interpreter's job: closed bars on every subscribed timeframe,
        //    in the same order the live builder emits them (1m, then derived).
        const pos = position as OpenPosition | null;
        const ctxPosition = pos ? { side: pos.side } : null;
        for (const tf of compiled.timeframes) {
            let closed: Bar | null = null;
            if (tf === '1m') {
                closed = bar;
            } else {
                closed = aggregators.get(tf)!.push(bar);
            }
            if (!closed) continue;

            const { decision, state } = compiled.onBar(tf, closed, botState, {
                position: ctxPosition,
                spreadPips,
            });
            botState = state;

            if (decision.exit && position) {
                const p: OpenPosition = position;
                const dir = p.side === 'BUY' ? 1 : -1;
                closeAt(closed.close - dir * half, barCloseTime, decision.exit.reason, closed.close);
            } else if (decision.enter && !position) {
                tryOpen(decision.enter, closed);
            }
        }

        // 3) Mark to market.
        let equity = balance;
        if (position) {
            const p: OpenPosition = position;
            const dir = p.side === 'BUY' ? 1 : -1;
            const exec = bar.close - dir * half;
            equity += (exec - p.entryExec) * dir * inst.contractSize * p.volume * quoteRate(bar.close)
                + p.swapAccrued - inst.commissionPerLot * p.volume;
        }
        equityCurve.push({ time: barCloseTime, equity });
        if (equity > peakEquity) peakEquity = equity;
        const dd = peakEquity - equity;
        if (dd > maxDrawdown) {
            maxDrawdown = dd;
            maxDrawdownPct = peakEquity > 0 ? (dd / peakEquity) * 100 : 0;
        }
    }

    // Close anything still open at the end so the result has no phantom
    // unrealised P/L hiding in it.
    if (position && lastBar) {
        const p: OpenPosition = position;
        const dir = p.side === 'BUY' ? 1 : -1;
        closeAt(lastBar.close - dir * half, lastBar.time + TIMEFRAME_MS['1m'], 'END_OF_DATA', lastBar.close);
    }
    if (sizingSkips > 0) {
        warnings.push(`${sizingSkips} entr${sizingSkips === 1 ? 'y' : 'ies'} skipped because the computed size was below the minimum volume.`);
    }

    // ── stats ───────────────────────────────────────────────────────
    const wins = trades.filter(t => t.netProfit > 0);
    const losses = trades.filter(t => t.netProfit <= 0);
    const grossProfit = wins.reduce((s, t) => s + t.netProfit, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netProfit, 0));
    const netProfit = balance - startBalance;

    const step = Math.max(1, Math.ceil(equityCurve.length / MAX_EQUITY_POINTS));
    const sampled = equityCurve.filter((_, i) => i % step === 0);
    if (equityCurve.length && sampled[sampled.length - 1] !== equityCurve[equityCurve.length - 1]) {
        sampled.push(equityCurve[equityCurve.length - 1]);
    }

    return {
        symbol: spec.symbol,
        timeframe: spec.timeframe,
        startBalance,
        endBalance: balance,
        stats: {
            trades: trades.length,
            wins: wins.length,
            losses: losses.length,
            winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
            netProfit,
            returnPct: (netProfit / startBalance) * 100,
            grossProfit,
            grossLoss,
            profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? null : 0),
            expectancy: trades.length ? netProfit / trades.length : 0,
            maxDrawdown,
            maxDrawdownPct,
            avgWin: wins.length ? grossProfit / wins.length : 0,
            avgLoss: losses.length ? grossLoss / losses.length : 0,
            totalCommission: trades.reduce((s, t) => s + t.commission, 0),
            totalSwap: trades.reduce((s, t) => s + t.swap, 0),
            totalSpreadCost,
            barsProcessed: processed,
            from: firstTime,
            to: lastBar ? lastBar.time + TIMEFRAME_MS['1m'] : firstTime,
        },
        trades,
        equityCurve: sampled,
        warnings,
    };
}
