/**
 * PORTFOLIO RISK — what the open positions actually add up to.
 *
 * A trader with longs on EUR/USD, GBP/USD and AUD/USD does not hold three
 * positions. They hold one bet against the dollar, at triple size, and
 * every risk number the platform shows them — margin, per-trade risk,
 * position count — hides that fact. This module says it out loud.
 *
 * It answers in two independent ways, on purpose:
 *
 *  1. **Currency exposure** — exact, not estimated. A long of 1.00
 *     EUR/USD is long 100,000 EUR and short the dollar value of it. Net
 *     the legs across every position and the concentration falls out of
 *     arithmetic, with no statistical assumption at all. This is the
 *     number to trust.
 *  2. **Correlation** — empirical, from stored candles, and therefore an
 *     estimate with a sample size. It catches what the exposure netting
 *     cannot (GOLD and AUD/USD share no currency but move together), and
 *     it is always reported with the number of observations behind it, so
 *     a coefficient from nine days is never dressed up as a fact.
 *
 * Nothing here predicts. Every figure describes positions that are
 * already open, or price history that has already happened.
 */

import { getSpec } from '../../config/instruments';
import { readBarsTf } from '../candles/store';
import { pipValue, rateToAccount, notionalInBase, ACCOUNT_CURRENCY } from '../pricing';
import { Bar } from '../strategy/types';

export interface OpenPositionLike {
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    volume: number;
    entryPrice: number;
    stopLoss?: number | null;
}

// ── currency exposure ───────────────────────────────────────────────

export interface CurrencyLeg {
    currency: string;
    /** Signed exposure in account currency: positive = long. */
    exposure: number;
    /**
     * |exposure| as a share of the book's size, 0..100+. These do NOT sum
     * to 100: every position contributes a leg to two currencies, so a
     * book of one position reads 100% on both sides of it. The question
     * each share answers is "how much of my book is a bet on this
     * currency", which is the one worth asking.
     */
    sharePct: number;
    /** Which positions contribute to this currency. */
    symbols: string[];
}

export interface ExposureReport {
    /**
     * Sum of the positions' notional values — the book's size.
     *
     * Deliberately *not* the sum of |leg exposure|. Every position has two
     * legs, so that sum is always twice the book, and for a book quoted
     * entirely in one currency the shares would come out at a flat 50%
     * for that currency no matter how lopsided the book is — the metric
     * would be blind to exactly the case it exists to catch.
     */
    gross: number;
    legs: CurrencyLeg[];
    /** Positions whose exposure could not be valued (no rate available). */
    skipped: string[];
}

const round2 = (n: number) => Number(n.toFixed(2));

/**
 * The account-currency value of one position's notional.
 *
 * Both legs of a trade are the same money seen from two sides, so one
 * number serves for both: a long of EUR/USD worth $110,000 is +$110,000
 * of EUR and −$110,000 of USD.
 */
export function positionValue(p: OpenPositionLike): number | undefined {
    const spec = getSpec(p.symbol);
    if (!spec) return undefined;
    const base = notionalInBase(spec, p.volume);
    const rate = rateToAccount(spec.base);
    if (rate !== undefined && Number.isFinite(rate)) return Math.abs(base * rate);

    // No rate for the base asset (a metal or a coin with no direct pair):
    // value the quote leg instead, which is the same money.
    const quoteRate = rateToAccount(spec.quote);
    if (quoteRate === undefined || !Number.isFinite(quoteRate)) return undefined;
    return Math.abs(base * p.entryPrice * quoteRate);
}

/**
 * Net every position down to its currency legs. Exact arithmetic — the
 * only reason a position is skipped is that no conversion rate exists
 * for it, and skipped positions are reported rather than dropped.
 */
export function currencyExposure(positions: OpenPositionLike[]): ExposureReport {
    const legs = new Map<string, { exposure: number; symbols: Set<string> }>();
    const skipped: string[] = [];

    const add = (ccy: string, amount: number, symbol: string) => {
        const cur = legs.get(ccy) ?? { exposure: 0, symbols: new Set<string>() };
        cur.exposure += amount;
        cur.symbols.add(symbol);
        legs.set(ccy, cur);
    };

    let book = 0;
    for (const p of positions) {
        const spec = getSpec(p.symbol);
        const value = positionValue(p);
        if (!spec || value === undefined) { skipped.push(p.symbol); continue; }
        const sign = p.side === 'BUY' ? 1 : -1;
        add(spec.base, sign * value, p.symbol);
        add(spec.quote, -sign * value, p.symbol);
        book += value;
    }

    const rows = [...legs.entries()].map(([currency, v]) => ({
        currency,
        exposure: round2(v.exposure),
        sharePct: 0,
        symbols: [...v.symbols].sort(),
    }));
    const gross = book;
    for (const r of rows) r.sharePct = gross > 0 ? Number(((Math.abs(r.exposure) / gross) * 100).toFixed(1)) : 0;

    return {
        gross: round2(gross),
        // Biggest absolute exposure first: the concentration is the point.
        legs: rows.sort((a, b) => Math.abs(b.exposure) - Math.abs(a.exposure)),
        skipped,
    };
}

// ── risk if the stops are hit ───────────────────────────────────────

export interface RiskReport {
    /** Money lost if every stop is hit, in account currency. */
    ifAllStopsHit: number;
    /** Per position, so the biggest single risk is visible. */
    perPosition: Array<{ id: string; symbol: string; risk: number | null }>;
    /** Positions with no stop — an unbounded loss, not a small one. */
    unstopped: Array<{ id: string; symbol: string }>;
}

/**
 * What the open book loses if every stop fills at its level.
 *
 * A position with no stop contributes nothing to the total, because its
 * loss has no number — it is listed separately instead. Quietly treating
 * an unstopped position as zero risk is how a risk screen ends up
 * reassuring somebody who is not safe.
 */
export function stopRisk(positions: OpenPositionLike[]): RiskReport {
    let total = 0;
    const perPosition: RiskReport['perPosition'] = [];
    const unstopped: RiskReport['unstopped'] = [];

    for (const p of positions) {
        const spec = getSpec(p.symbol);
        if (!spec || p.stopLoss == null || !Number.isFinite(p.stopLoss)) {
            unstopped.push({ id: p.id, symbol: p.symbol });
            perPosition.push({ id: p.id, symbol: p.symbol, risk: null });
            continue;
        }
        const pv = pipValue(p.symbol, p.volume);
        if (pv === undefined || !Number.isFinite(pv)) {
            perPosition.push({ id: p.id, symbol: p.symbol, risk: null });
            continue;
        }
        // A stop on the wrong side of entry is already in profit; it
        // cannot lose money, so it contributes zero rather than a
        // negative that would flatter the total.
        const adverse = p.side === 'BUY' ? p.entryPrice - p.stopLoss : p.stopLoss - p.entryPrice;
        const risk = Math.max(0, round2((adverse / spec.pipSize) * pv));
        total += risk;
        perPosition.push({ id: p.id, symbol: p.symbol, risk });
    }

    return {
        ifAllStopsHit: round2(total),
        perPosition: perPosition.sort((a, b) => (b.risk ?? -1) - (a.risk ?? -1)),
        unstopped,
    };
}

// ── correlation ─────────────────────────────────────────────────────

export interface CorrelationPair {
    a: string;
    b: string;
    /** Pearson r on daily log returns, -1..1. */
    r: number;
    /** How many paired daily returns it was computed from. */
    days: number;
}

/** Log returns of consecutive closes, keyed by bar open time. */
function logReturns(bars: Bar[]): Map<number, number> {
    const out = new Map<number, number>();
    for (let i = 1; i < bars.length; i++) {
        const prev = bars[i - 1].close, cur = bars[i].close;
        if (prev > 0 && cur > 0) out.set(bars[i].time, Math.log(cur / prev));
    }
    return out;
}

export function pearson(xs: number[], ys: number[]): number {
    const n = Math.min(xs.length, ys.length);
    if (n < 2) return NaN;
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
        const a = xs[i] - mx, b = ys[i] - my;
        num += a * b; dx += a * a; dy += b * b;
    }
    // A flat series has no variance and therefore no correlation to
    // report — NaN, not zero, which would read as "unrelated".
    if (dx === 0 || dy === 0) return NaN;
    return num / Math.sqrt(dx * dy);
}

/** Below this many paired days a coefficient is not reported at all. */
export const MIN_CORR_DAYS = 30;
/** At or above this, two instruments are treated as the same bet. */
export const SAME_BET_R = 0.7;

/**
 * Pairwise correlation of daily log returns, on dates both instruments
 * traded. `barsFor` is injectable so tests can supply series directly.
 */
export function correlations(
    symbols: string[],
    opts: { days?: number; now?: number; barsFor?: (s: string) => Bar[] } = {}
): CorrelationPair[] {
    const days = opts.days ?? 120;
    const now = opts.now ?? Date.now();
    const from = now - days * 86_400_000;
    const read = opts.barsFor ?? ((s: string) => readBarsTf(s, '1d', from, now));

    const returns = new Map<string, Map<number, number>>();
    for (const s of new Set(symbols)) {
        try { returns.set(s, logReturns(read(s))); }
        catch { /* an instrument with no stored candles simply has no row */ }
    }

    const uniq = [...returns.keys()].sort();
    const out: CorrelationPair[] = [];
    for (let i = 0; i < uniq.length; i++) {
        for (let j = i + 1; j < uniq.length; j++) {
            const A = returns.get(uniq[i])!, B = returns.get(uniq[j])!;
            const xs: number[] = [], ys: number[] = [];
            // Only dates both instruments have: pairing a Friday against a
            // Monday would manufacture a correlation out of a calendar.
            for (const [t, a] of A) {
                const b = B.get(t);
                if (b !== undefined) { xs.push(a); ys.push(b); }
            }
            if (xs.length < MIN_CORR_DAYS) continue;
            const r = pearson(xs, ys);
            if (!Number.isFinite(r)) continue;
            out.push({ a: uniq[i], b: uniq[j], r: Number(r.toFixed(2)), days: xs.length });
        }
    }
    return out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
}

/**
 * Group symbols that move together into clusters, so a book of six
 * positions can be read as the two or three bets it really is.
 *
 * Single-link clustering: A joins B's cluster when |r| >= threshold with
 * any of its members. Deliberately the loose kind of clustering — for a
 * risk warning, being told two things *might* be the same bet is the
 * useful error, and the strict alternative would split a chain of highly
 * correlated instruments into separate "safe" groups.
 */
export function clusterBySymbol(
    symbols: string[],
    pairs: CorrelationPair[],
    threshold = SAME_BET_R
): string[][] {
    const parent = new Map<string, string>();
    const uniq = [...new Set(symbols)].sort();
    for (const s of uniq) parent.set(s, s);

    const find = (s: string): string => {
        let root = s;
        while (parent.get(root) !== root) root = parent.get(root)!;
        return root;
    };
    const union = (a: string, b: string) => {
        const ra = find(a), rb = find(b);
        if (ra !== rb) parent.set(ra, rb);
    };

    for (const p of pairs) {
        if (Math.abs(p.r) < threshold) continue;
        if (parent.has(p.a) && parent.has(p.b)) union(p.a, p.b);
    }

    const groups = new Map<string, string[]>();
    for (const s of uniq) {
        const root = find(s);
        groups.set(root, [...(groups.get(root) ?? []), s]);
    }
    return [...groups.values()]
        .map(g => g.sort())
        .sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
}

// ── the report ──────────────────────────────────────────────────────

export interface PortfolioFinding {
    key: string;
    severity: 'INFO' | 'WARN' | 'ALERT';
    fa: string;
    en: string;
    evidence: Record<string, any>;
}

/** Above this share of gross exposure, one currency is the whole book. */
const CONCENTRATION_WARN = 55;
const CONCENTRATION_ALERT = 75;

/**
 * Money for a sentence, not a ledger. Six-figure exposures appear in these
 * findings, and "$196100.00" is unreadable mid-sentence — thousands
 * separators and no cents above $1,000, exact cents below it.
 */
const money = (n: number) => {
    const a = Math.abs(n);
    const body = a >= 1000 ? Math.round(a).toLocaleString('en-US') : a.toFixed(2);
    return `${n < 0 ? '-' : ''}$${body}`;
};
const ccyFa: Record<string, string> = {
    USD: 'دلار', EUR: 'یورو', GBP: 'پوند', JPY: 'یِن', CHF: 'فرانک',
    AUD: 'دلار استرالیا', CAD: 'دلار کانادا', NZD: 'دلار نیوزیلند',
    XAU: 'طلا', XAG: 'نقره', BTC: 'بیت‌کوین', ETH: 'اتریوم', USDT: 'تتر',
};
const nameOf = (c: string) => ccyFa[c] ?? c;

/**
 * The sentences. Rendered from the numbers above, in the order a trader
 * should read them: what the book really is, then what it can lose, then
 * what is unbounded.
 */
export function portfolioFindings(
    exposure: ExposureReport,
    risk: RiskReport,
    clusters: string[][],
    pairs: CorrelationPair[],
    equity?: number | null
): PortfolioFinding[] {
    const out: PortfolioFinding[] = [];

    const top = exposure.legs[0];
    // One position is trivially 100% concentrated; that is arithmetic, not
    // a finding. The warning is about several positions being one bet.
    if (top && top.symbols.length > 1 && top.sharePct >= CONCENTRATION_WARN) {
        const dir = top.exposure > 0 ? 'خرید' : 'فروش';
        const dirEn = top.exposure > 0 ? 'long' : 'short';
        out.push({
            key: 'concentration',
            severity: top.sharePct >= CONCENTRATION_ALERT ? 'ALERT' : 'WARN',
            fa: `${top.sharePct}٪ از حجم بازِ شما یک شرط است: ${dir} ${nameOf(top.currency)}`
                + ` به ارزش ${money(Math.abs(top.exposure))}. ${top.symbols.length} پوزیشن دارید،`
                + ` اما در عمل یک موضع.`,
            en: `${top.sharePct}% of your open exposure is one bet: ${dirEn} ${top.currency},`
                + ` ${money(Math.abs(top.exposure))}. ${top.symbols.length} positions, one direction.`,
            evidence: { currency: top.currency, sharePct: top.sharePct, exposure: top.exposure, symbols: top.symbols },
        });
    }

    // A cluster of instruments that move together but share no currency
    // is the case exposure netting cannot see.
    for (const group of clusters) {
        if (group.length < 2) continue;
        const inside = pairs.filter(p => group.includes(p.a) && group.includes(p.b));
        if (!inside.length) continue;
        const strongest = inside.reduce((a, b) => (Math.abs(b.r) > Math.abs(a.r) ? b : a));
        out.push({
            key: `cluster:${group.join('+')}`,
            severity: 'WARN',
            fa: `${group.join('، ')} با هم حرکت می‌کنند (همبستگی ${strongest.r} روی`
                + ` ${strongest.days} روز بین ${strongest.a} و ${strongest.b}). ریسک این‌ها جمع می‌شود، نه پخش.`,
            en: `${group.join(', ')} move together (r = ${strongest.r} over ${strongest.days} days`
                + ` between ${strongest.a} and ${strongest.b}). Their risk adds up rather than spreading.`,
            evidence: { group, r: strongest.r, days: strongest.days },
        });
    }

    if (risk.unstopped.length) {
        const names = [...new Set(risk.unstopped.map(u => u.symbol))];
        out.push({
            key: 'unstopped',
            severity: 'ALERT',
            fa: `${risk.unstopped.length} پوزیشن بدون حد ضرر باز است (${names.join('، ')}).`
                + ` ضرر این‌ها عدد ندارد، پس در جمعِ «اگر همه‌ی حد ضررها بخورند» هم نیامده.`,
            en: `${risk.unstopped.length} position(s) have no stop (${names.join(', ')}).`
                + ` Their loss has no number, so it is not in the all-stops-hit total either.`,
            evidence: { count: risk.unstopped.length, symbols: names },
        });
    }

    if (risk.ifAllStopsHit > 0) {
        const pct = equity && equity > 0 ? Number(((risk.ifAllStopsHit / equity) * 100).toFixed(1)) : null;
        out.push({
            key: 'stopRisk',
            severity: pct !== null && pct >= 10 ? 'WARN' : 'INFO',
            fa: `اگر همه‌ی حد ضررها با هم بخورند، ${money(risk.ifAllStopsHit)}`
                + `${pct !== null ? ` (${pct}٪ حساب)` : ''} از دست می‌رود.`,
            en: `If every stop is hit at once, ${money(risk.ifAllStopsHit)}`
                + `${pct !== null ? ` (${pct}% of the account)` : ''} is gone.`,
            evidence: { risk: risk.ifAllStopsHit, equity: equity ?? null, pct },
        });
    }

    const order = { ALERT: 0, WARN: 1, INFO: 2 };
    return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

export interface PortfolioReport {
    accountCurrency: string;
    positions: number;
    exposure: ExposureReport;
    risk: RiskReport;
    correlations: CorrelationPair[];
    clusters: string[][];
    findings: PortfolioFinding[];
}

/** The whole report for a set of open positions. */
export function buildPortfolioReport(
    positions: OpenPositionLike[],
    opts: { equity?: number | null; barsFor?: (s: string) => Bar[]; now?: number } = {}
): PortfolioReport {
    const exposure = currencyExposure(positions);
    const risk = stopRisk(positions);
    const symbols = [...new Set(positions.map(p => p.symbol))];
    const pairs = symbols.length > 1
        ? correlations(symbols, { barsFor: opts.barsFor, now: opts.now })
        : [];
    const clusters = clusterBySymbol(symbols, pairs);

    return {
        accountCurrency: ACCOUNT_CURRENCY,
        positions: positions.length,
        exposure,
        risk,
        correlations: pairs,
        clusters,
        findings: portfolioFindings(exposure, risk, clusters, pairs, opts.equity),
    };
}
