/**
 * STRATEGY INTERPRETER
 *
 * Evaluates a validated StrategySpec on bar closes and emits decisions. It is
 * the ONLY component that understands the grammar — the live bot runner, the
 * forward test and the backtester all call this same code with a different
 * clock, which is what makes their results comparable by construction.
 *
 * No look-ahead, mechanically: the interpreter only ever receives CLOSED
 * bars, higher-timeframe indicators expose the value of their last closed
 * bar, and crossovers compare this bar against the previous one. There is no
 * API through which a condition could observe a forming bar.
 *
 * The interpreter decides *whether to be in* a position. Managing the fill —
 * stop loss, take profit, trailing, stop-out — is the execution engine's
 * tick-level job (services/pricing.ts + tradeController).
 */

import { getSpec, roundPrice } from '../../config/instruments';
import { createIndicator, Incr, Ring, sourceValue } from './indicators';
import { BarSeries } from './series';
import {
    Bar, BarContext, BotState, Condition, Decision, Distance, EntryDecision,
    Filter, Operand, SESSION_HOURS_UTC, Source, SOURCES, StrategySpec,
    TIMEFRAME_MS, TakeProfitLevel, Timeframe,
} from './types';
import { MAX_LOOKBACK_BARS, validateSpec } from './validate';

/** History depth for operands — covers crossovers and rising/falling(N). */
const OPERAND_HISTORY = MAX_LOOKBACK_BARS + 2;

/** Period of the internal ATR that prices atrMultiple exits. */
const EXIT_ATR_PERIOD = 14;

export interface CompiledStrategy {
    readonly spec: StrategySpec;
    /** Every timeframe this strategy must be fed closed bars for. */
    readonly timeframes: Timeframe[];
    /**
     * Feed one closed bar. Bars of the spec timeframe produce a decision;
     * bars of other subscribed timeframes only update their indicators.
     * `state` is not mutated — the advanced copy is returned.
     */
    onBar(tf: Timeframe, bar: Bar, state: BotState, ctx?: BarContext): { decision: Decision; state: BotState };
}

export function compileStrategy(spec: StrategySpec): CompiledStrategy {
    const check = validateSpec(spec);
    if (!check.ok) {
        const detail = check.errors.map(e => `${e.path}: ${e.message}`).join('; ');
        throw new Error(`Invalid strategy spec — ${detail}`);
    }
    return new Interpreter(check.spec!);
}

class Interpreter implements CompiledStrategy {
    readonly spec: StrategySpec;
    readonly timeframes: Timeframe[];

    private pipSize: number;
    private indicators = new Map<string, { inst: Incr; timeframe: Timeframe }>();
    /** Per-timeframe bar history (price sources + prev bars). */
    private series = new Map<Timeframe, BarSeries>();
    /** Snapshot of every referenced operand, one value per spec-tf bar. */
    private histories = new Map<string, Ring>();
    private trackedOperands: string[];
    private exitAtr: Incr | null = null;

    constructor(spec: StrategySpec) {
        this.spec = spec;
        this.pipSize = getSpec(spec.symbol).pipSize;

        const tfs = new Set<Timeframe>([spec.timeframe]);

        for (const [id, def] of Object.entries(spec.indicators ?? {})) {
            const tf = def.timeframe ?? spec.timeframe;
            tfs.add(tf);
            this.indicators.set(id, { inst: createIndicator(def), timeframe: tf });
        }

        if (usesAtrDistance(spec)) {
            this.exitAtr = createIndicator({ type: 'ATR', period: EXIT_ATR_PERIOD });
        }

        this.timeframes = Array.from(tfs);
        for (const tf of this.timeframes) {
            this.series.set(tf, new BarSeries(tf, OPERAND_HISTORY + 8));
        }

        this.trackedOperands = collectOperands(spec);
        for (const op of this.trackedOperands) {
            this.histories.set(op, new Ring(OPERAND_HISTORY));
        }
    }

    onBar(tf: Timeframe, bar: Bar, state: BotState, ctx: BarContext = {}): { decision: Decision; state: BotState } {
        if (!this.series.has(tf)) return { decision: {}, state };

        this.series.get(tf)!.push(bar);
        for (const { inst, timeframe } of this.indicators.values()) {
            if (timeframe === tf) inst.update(bar);
        }
        if (tf === this.spec.timeframe && this.exitAtr) this.exitAtr.update(bar);

        if (tf !== this.spec.timeframe) return { decision: {}, state };

        // Snapshot every referenced operand for this bar — crossovers and
        // rising/falling read these rings, so higher-timeframe indicators are
        // sampled on the spec clock and can never leak a forming value.
        for (const op of this.trackedOperands) {
            this.histories.get(op)!.push(this.resolveNow(op));
        }

        const next: BotState = { ...state };
        const closeTime = bar.time + TIMEFRAME_MS[this.spec.timeframe];
        const dayKey = String(Math.floor(closeTime / 86_400_000));
        if (dayKey !== next.dayKey) {
            next.dayKey = dayKey;
            next.tradesToday = 0;
        }

        const position = ctx.position ?? null;

        // ── in a position: exits only ──
        if (position) {
            next.barsInPosition++;

            const sigExit = position.side === 'BUY' ? this.spec.exit.signal?.long : this.spec.exit.signal?.short;
            if (sigExit && this.evaluate(sigExit)) {
                next.barsInPosition = 0;
                next.cooldown = this.spec.limits?.cooldownBars ?? 0;
                return { decision: { exit: { reason: 'SIGNAL' } }, state: next };
            }
            if (this.spec.exit.timeStop && next.barsInPosition >= this.spec.exit.timeStop.bars) {
                next.barsInPosition = 0;
                next.cooldown = this.spec.limits?.cooldownBars ?? 0;
                return { decision: { exit: { reason: 'TIME_STOP' } }, state: next };
            }
            return { decision: {}, state: next };
        }

        // ── flat: entries ──
        next.barsInPosition = 0;

        if (!this.filtersPass(closeTime, ctx)) return { decision: {}, state: next };
        // cooldownBars = N means N full flat bars with no entry after an exit,
        // so the counter is consumed here, where it blocks — not on the exit
        // bar itself.
        if (next.cooldown > 0) {
            next.cooldown--;
            return { decision: {}, state: next };
        }
        const maxPerDay = this.spec.limits?.maxTradesPerDay;
        if (maxPerDay !== undefined && next.tradesToday >= maxPerDay) {
            return { decision: {}, state: next };
        }

        const longSignal = this.spec.entry.long ? this.evaluate(this.spec.entry.long) : false;
        const shortSignal = this.spec.entry.short ? this.evaluate(this.spec.entry.short) : false;
        // Both firing at once is a contradiction, not a coin flip — stand aside.
        if (longSignal === shortSignal) return { decision: {}, state: next };

        const side = longSignal ? 'BUY' : 'SELL';
        const enter = this.buildEntry(side, bar);
        if (!enter) return { decision: {}, state: next };

        next.tradesToday++;
        return { decision: { enter }, state: next };
    }

    // ────────────────────────────────────────────────────────────────

    /** Current value of an operand, straight from series/indicators. */
    private resolveNow(op: string): number {
        if ((SOURCES as string[]).includes(op)) {
            const bar = this.series.get(this.spec.timeframe)!.bar(0);
            return bar ? sourceValue(bar, op as Source) : NaN;
        }
        const [id, field] = op.split('.');
        const entry = this.indicators.get(id);
        return entry ? entry.inst.value(field) : NaN;
    }

    /** Operand value as of `back` spec-tf bars ago (0 = this bar). */
    private valueAgo(op: Operand, back: number): number {
        if (typeof op === 'number') return op;
        const ring = this.histories.get(op);
        return ring ? ring.get(back) : NaN;
    }

    private evaluate(cond: Condition): boolean {
        const c = cond as Record<string, any>;

        if (c.all) return (c.all as Condition[]).every(x => this.evaluate(x));
        if (c.any) return (c.any as Condition[]).some(x => this.evaluate(x));
        if (c.not) return !this.evaluate(c.not as Condition);

        const cmp = (a: number, b: number, op: string): boolean => {
            if (Number.isNaN(a) || Number.isNaN(b)) return false; // warm-up never trades
            switch (op) {
                case 'gt': return a > b;
                case 'gte': return a >= b;
                case 'lt': return a < b;
                case 'lte': return a <= b;
                default: return false;
            }
        };

        for (const op of ['gt', 'gte', 'lt', 'lte'] as const) {
            if (c[op]) return cmp(this.valueAgo(c[op][0], 0), this.valueAgo(c[op][1], 0), op);
        }

        if (c.crossesAbove || c.crossesBelow) {
            const [a, b] = (c.crossesAbove ?? c.crossesBelow) as [Operand, Operand];
            const curA = this.valueAgo(a, 0);
            const curB = this.valueAgo(b, 0);
            const prevA = this.valueAgo(a, 1);
            const prevB = this.valueAgo(b, 1);
            if ([curA, curB, prevA, prevB].some(Number.isNaN)) return false;
            return c.crossesAbove
                ? prevA <= prevB && curA > curB
                : prevA >= prevB && curA < curB;
        }

        if (c.rising || c.falling) {
            const [op, bars] = (c.rising ?? c.falling) as [Operand, number];
            const cur = this.valueAgo(op, 0);
            const past = this.valueAgo(op, bars);
            if (Number.isNaN(cur) || Number.isNaN(past)) return false;
            return c.rising ? cur > past : cur < past;
        }

        return false;
    }

    private filtersPass(closeTime: number, ctx: BarContext): boolean {
        for (const f of this.spec.filters ?? []) {
            if (!this.filterPasses(f, closeTime, ctx)) return false;
        }
        return true;
    }

    private filterPasses(f: Filter, closeTime: number, ctx: BarContext): boolean {
        const ff = f as Record<string, any>;
        if (ff.session) {
            return hourInRange(new Date(closeTime).getUTCHours(), SESSION_HOURS_UTC[ff.session as keyof typeof SESSION_HOURS_UTC]);
        }
        if (ff.hoursUtc) {
            return hourInRange(new Date(closeTime).getUTCHours(), ff.hoursUtc as [number, number]);
        }
        if (ff.weekdaysUtc) {
            return (ff.weekdaysUtc as number[]).includes(new Date(closeTime).getUTCDay());
        }
        if (ff.maxSpreadPips !== undefined) {
            // Unknown spread (plain backtest) passes; a known spread is enforced.
            return ctx.spreadPips === undefined || ctx.spreadPips <= ff.maxSpreadPips;
        }
        return true;
    }

    private buildEntry(side: 'BUY' | 'SELL', bar: Bar): EntryDecision | null {
        const slDist = this.distance(this.spec.exit.stopLoss);
        if (slDist === null) return null; // ATR-based stop before ATR is ready

        const dir = side === 'BUY' ? 1 : -1;
        const stopLossPrice = roundPrice(this.spec.symbol, bar.close - dir * slDist);

        let takeProfitPrice: number | null = null;
        if (this.spec.exit.takeProfit) {
            const tpDist = this.tpDistance(this.spec.exit.takeProfit, slDist);
            if (tpDist === null) return null;
            takeProfitPrice = roundPrice(this.spec.symbol, bar.close + dir * tpDist);
        }

        let trailingDistance: number | null = null;
        if (this.spec.exit.trailingStop) {
            trailingDistance = this.distance(this.spec.exit.trailingStop);
            if (trailingDistance === null) return null;
        }

        return {
            side,
            stopLossPrice,
            takeProfitPrice,
            trailingDistance,
            sizing: this.spec.sizing,
            reason: side === 'BUY' ? 'entry.long' : 'entry.short',
        };
    }

    /** A Distance in price units, or null when its ATR is not ready yet. */
    private distance(d: Distance): number | null {
        if ('pips' in d) return d.pips * this.pipSize;
        const atr = this.exitAtr!.value();
        return Number.isNaN(atr) ? null : d.atrMultiple * atr;
    }

    private tpDistance(tp: TakeProfitLevel, slDist: number): number | null {
        if ('rMultiple' in tp) return tp.rMultiple * slDist;
        return this.distance(tp);
    }
}

// ═══════════════════════════════════════════════════════════════════

function hourInRange(hour: number, [from, to]: [number, number]): boolean {
    return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

function usesAtrDistance(spec: StrategySpec): boolean {
    const dists: (Distance | TakeProfitLevel | undefined)[] = [
        spec.exit.stopLoss, spec.exit.takeProfit, spec.exit.trailingStop,
    ];
    return dists.some(d => d !== undefined && 'atrMultiple' in d);
}

/** Every string operand referenced anywhere in the spec's conditions. */
function collectOperands(spec: StrategySpec): string[] {
    const found = new Set<string>();
    const fromCondition = (cond: Condition | undefined): void => {
        if (!cond) return;
        const c = cond as Record<string, any>;
        if (c.all || c.any) (c.all ?? c.any).forEach(fromCondition);
        else if (c.not) fromCondition(c.not);
        else {
            const args = Object.values(c)[0] as unknown[];
            for (const a of args) if (typeof a === 'string') found.add(a);
        }
    };
    fromCondition(spec.entry.long);
    fromCondition(spec.entry.short);
    fromCondition(spec.exit.signal?.long);
    fromCondition(spec.exit.signal?.short);
    return Array.from(found);
}
