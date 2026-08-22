/**
 * HONESTY GRADE
 *
 * A backtest number without a trust assessment is marketing. Five checks,
 * each scored 0–100, combined into a letter grade the UI shows NEXT TO the
 * return, never instead of it:
 *
 *  1. Sample size        — 12 trades prove nothing, whatever the return.
 *  2. Out-of-sample      — does the last 30% of the period, which the user
 *                          (or the AI) never optimised against, still work?
 *  3. Parameter pressure — many tuned numbers + few trades = curve fitting.
 *  4. Sensitivity        — nudge every numeric parameter ±10% and re-run;
 *                          a real edge survives, a fitted one shatters.
 *  5. Monte Carlo        — reshuffle the trade order; the drawdown the user
 *                          should expect is the p95 of that distribution,
 *                          not the one lucky ordering history happened upon.
 *
 * The grade measures how much the backtest can be TRUSTED, not how good the
 * strategy is — an honestly-measured losing strategy can grade A.
 */

import { validateSpec } from '../strategy/validate';
import { StrategySpec } from '../strategy/types';
import { BacktestResult } from './engine';

export interface HonestyCheck {
    key: 'sampleSize' | 'outOfSample' | 'parameterPressure' | 'sensitivity' | 'monteCarlo';
    score: number;
    summary: string;
    detail?: Record<string, number | string | boolean>;
}

export interface HonestyReport {
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    score: number;
    checks: HonestyCheck[];
}

const WEIGHTS: Record<HonestyCheck['key'], number> = {
    sampleSize: 0.25,
    outOfSample: 0.25,
    parameterPressure: 0.15,
    sensitivity: 0.20,
    monteCarlo: 0.15,
};

const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

// ── 1. sample size ──────────────────────────────────────────────────
function checkSampleSize(result: BacktestResult): HonestyCheck {
    const n = result.stats.trades;
    // 150+ trades → full marks; square-root taper below that.
    const score = clamp(100 * Math.sqrt(n / 150));
    const summary = n >= 150
        ? `${n} trades — statistically meaningful.`
        : n >= 30
            ? `${n} trades — usable, but treat the numbers as rough.`
            : `${n} trades — far too few to conclude anything.`;
    return { key: 'sampleSize', score, summary, detail: { trades: n } };
}

// ── 2. out-of-sample split ──────────────────────────────────────────
function checkOutOfSample(result: BacktestResult): HonestyCheck {
    const { from, to } = result.stats;
    const splitAt = from + (to - from) * 0.7;
    const is_ = result.trades.filter(t => t.entryTime < splitAt);
    const oos = result.trades.filter(t => t.entryTime >= splitAt);

    if (oos.length < 5) {
        return {
            key: 'outOfSample', score: 30,
            summary: `Only ${oos.length} trades in the final 30% of the period — the out-of-sample window is too thin to verify.`,
            detail: { isTrades: is_.length, oosTrades: oos.length },
        };
    }
    const expectancy = (ts: typeof result.trades) => ts.reduce((s, t) => s + t.netProfit, 0) / ts.length;
    const eIS = expectancy(is_);
    const eOOS = expectancy(oos);
    const detail = {
        isTrades: is_.length, oosTrades: oos.length,
        isExpectancy: Number(eIS.toFixed(2)), oosExpectancy: Number(eOOS.toFixed(2)),
    };

    if (eIS <= 0) {
        // Nothing was "fit" to the early window that the late window could expose.
        return {
            key: 'outOfSample', score: 70,
            summary: 'The in-sample period is itself unprofitable; the split reveals no over-fitting (there is no fitted profit to lose).',
            detail,
        };
    }
    if (eOOS > 0 && eOOS >= eIS * 0.4) {
        return { key: 'outOfSample', score: 90, summary: 'The unseen final 30% performs in line with the rest — a good sign.', detail };
    }
    if (eOOS > 0) {
        return { key: 'outOfSample', score: 60, summary: 'Still profitable out-of-sample, but noticeably weaker than in-sample.', detail };
    }
    return {
        key: 'outOfSample', score: 15,
        summary: 'Profitable in-sample, losing out-of-sample — the classic over-fitting signature.',
        detail,
    };
}

// ── 3. parameter pressure ───────────────────────────────────────────
/** Count every number a human (or AI) could have tuned. */
export function countTunedParameters(spec: StrategySpec): number {
    let count = 0;
    const walkCondition = (c: any): void => {
        if (c == null || typeof c !== 'object') return;
        for (const [k, v] of Object.entries(c)) {
            if (k === 'all' || k === 'any') (v as any[]).forEach(walkCondition);
            else if (k === 'not') walkCondition(v);
            else if (Array.isArray(v)) {
                for (const operand of v) if (typeof operand === 'number') count++;
            }
        }
    };
    for (const def of Object.values(spec.indicators ?? {})) {
        for (const v of Object.values(def as unknown as Record<string, unknown>)) {
            if (typeof v === 'number') count++;
        }
    }
    walkCondition(spec.entry.long);
    walkCondition(spec.entry.short);
    walkCondition(spec.exit.signal?.long);
    walkCondition(spec.exit.signal?.short);
    const numbersIn = (o: unknown) => {
        if (o && typeof o === 'object') {
            for (const v of Object.values(o as Record<string, unknown>)) if (typeof v === 'number') count++;
        }
    };
    numbersIn(spec.exit.stopLoss);
    numbersIn(spec.exit.takeProfit);
    numbersIn(spec.exit.trailingStop);
    numbersIn(spec.exit.timeStop);
    return count;
}

function checkParameterPressure(spec: StrategySpec, result: BacktestResult): HonestyCheck {
    const params = Math.max(1, countTunedParameters(spec));
    const perParam = result.stats.trades / params;
    const score = perParam >= 30 ? 100 : perParam >= 15 ? 75 : perParam >= 8 ? 50 : perParam >= 4 ? 30 : 15;
    return {
        key: 'parameterPressure', score,
        summary: `${params} tunable numbers, ${result.stats.trades} trades — ${perParam.toFixed(1)} trades per parameter${perParam < 8 ? ': heavy curve-fitting risk' : ''}.`,
        detail: { parameters: params, tradesPerParameter: Number(perParam.toFixed(1)) },
    };
}

// ── 4. ±10% sensitivity ─────────────────────────────────────────────
/** Every spec variant with one indicator parameter nudged ±10%. */
export function perturbSpec(spec: StrategySpec, maxVariants = 12): StrategySpec[] {
    const variants: StrategySpec[] = [];
    const indicators = spec.indicators ?? {};
    for (const [name, def] of Object.entries(indicators)) {
        for (const [field, value] of Object.entries(def as unknown as Record<string, unknown>)) {
            if (typeof value !== 'number' || field === 'timeframe') continue;
            for (const factor of [0.9, 1.1]) {
                const nudged = Number.isInteger(value)
                    ? Math.max(1, Math.round(value * factor))
                    : value * factor;
                if (nudged === value) continue;
                const clone = JSON.parse(JSON.stringify(spec)) as StrategySpec;
                (clone.indicators![name] as any)[field] = nudged;
                if (validateSpec(clone).ok) variants.push(clone);
                if (variants.length >= maxVariants) return variants;
            }
        }
    }
    return variants;
}

function checkSensitivity(
    spec: StrategySpec,
    result: BacktestResult,
    rerun: (variant: StrategySpec) => BacktestResult
): HonestyCheck {
    const base = result.stats.netProfit;
    const variants = perturbSpec(spec);
    if (!variants.length) {
        return {
            key: 'sensitivity', score: 60,
            summary: 'No numeric indicator parameters to perturb — nothing to over-fit there, but nothing verified either.',
        };
    }
    if (base <= 0) {
        return {
            key: 'sensitivity', score: 50,
            summary: 'The base run is unprofitable; parameter sensitivity says nothing useful about it.',
        };
    }

    let profitable = 0;
    let worst = Infinity;
    for (const v of variants) {
        let net: number;
        try {
            net = rerun(v).stats.netProfit;
        } catch {
            continue;
        }
        if (net > 0) profitable++;
        if (net < worst) worst = net;
    }
    const frac = profitable / variants.length;
    const worstRatio = worst === Infinity ? 0 : worst / base;
    const score = frac === 1 && worstRatio >= 0.5 ? 95
        : frac >= 0.8 ? 70
        : frac >= 0.5 ? 45
        : 15;
    return {
        key: 'sensitivity', score,
        summary: `${profitable}/${variants.length} ±10% parameter variants stay profitable` +
            (worst !== Infinity ? `; worst case keeps ${(worstRatio * 100).toFixed(0)}% of the profit.` : '.'),
        detail: { variants: variants.length, profitableVariants: profitable, worstNetProfit: worst === Infinity ? 0 : Number(worst.toFixed(2)) },
    };
}

// ── 5. trade-order Monte Carlo ──────────────────────────────────────
/** Deterministic LCG so the same backtest always grades the same. */
function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

function checkMonteCarlo(result: BacktestResult): HonestyCheck {
    const profits = result.trades.map(t => t.netProfit);
    if (profits.length < 5) {
        return { key: 'monteCarlo', score: 20, summary: 'Too few trades to resample the order.' };
    }
    const rand = lcg(0xC0FFEE ^ profits.length);
    const RUNS = 500;
    const start = result.startBalance;
    const drawdowns: number[] = [];
    let endsInLoss = 0;

    const shuffled = profits.slice();
    for (let run = 0; run < RUNS; run++) {
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        let equity = start;
        let peak = start;
        let maxDdPct = 0;
        for (const p of shuffled) {
            equity += p;
            if (equity > peak) peak = equity;
            const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 100;
            if (dd > maxDdPct) maxDdPct = dd;
        }
        drawdowns.push(maxDdPct);
        if (equity < start) endsInLoss++;
    }
    drawdowns.sort((a, b) => a - b);
    const p95 = drawdowns[Math.floor(RUNS * 0.95)];
    const pLoss = endsInLoss / RUNS;

    const ddScore = p95 <= 15 ? 95 : p95 <= 30 ? 70 : p95 <= 50 ? 40 : 15;
    const score = clamp(ddScore * (1 - pLoss * 0.7));
    return {
        key: 'monteCarlo', score,
        summary: `Reshuffling the trade order ${RUNS}×: expect up to ${p95.toFixed(1)}% drawdown (p95); ${(pLoss * 100).toFixed(0)}% of orderings end at a loss.`,
        detail: { p95DrawdownPct: Number(p95.toFixed(1)), probEndInLoss: Number(pLoss.toFixed(3)) },
    };
}

// ── combined ────────────────────────────────────────────────────────
export function gradeBacktest(
    spec: StrategySpec,
    result: BacktestResult,
    rerun: (variant: StrategySpec) => BacktestResult
): HonestyReport {
    const checks: HonestyCheck[] = [
        checkSampleSize(result),
        checkOutOfSample(result),
        checkParameterPressure(spec, result),
        checkSensitivity(spec, result, rerun),
        checkMonteCarlo(result),
    ];
    const score = clamp(checks.reduce((s, c) => s + c.score * WEIGHTS[c.key], 0));
    const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F';
    return { grade, score, checks };
}
