/**
 * The shape of an account over time, from its daily snapshots.
 *
 * All of this is pure: given the rows, the curve, the drawdown and the
 * monthly table follow. Anything that needs the database lives in
 * accountHistory.ts, so the maths can be tested without one.
 */

export interface SnapshotRow {
    /** UTC day, YYYY-MM-DD. */
    day: string;
    balance: number;
    equity: number;
    realised: number;
    trades: number;
}

export interface CurvePoint extends SnapshotRow {
    /** Highest equity seen up to and including this day. */
    peak: number;
    /** How far below that peak this day closed, in money and percent. */
    drawdown: number;
    drawdownPct: number;
    /** Change against the previous day's equity, in money and percent. */
    change: number;
    changePct: number | null;
}

export interface CurveSummary {
    points: CurvePoint[];
    startEquity: number;
    endEquity: number;
    change: number;
    changePct: number | null;
    peakEquity: number;
    maxDrawdown: number;
    maxDrawdownPct: number;
    bestDay: { day: string; change: number } | null;
    worstDay: { day: string; change: number } | null;
    tradingDays: number;
    trades: number;
    realised: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function buildCurve(rows: SnapshotRow[]): CurveSummary {
    const sorted = [...rows]
        .filter(r => Number.isFinite(r.equity))
        .sort((a, b) => a.day.localeCompare(b.day));

    const points: CurvePoint[] = [];
    let peak = -Infinity;
    let maxDrawdown = 0;
    let maxDrawdownPct = 0;
    let best: { day: string; change: number } | null = null;
    let worst: { day: string; change: number } | null = null;

    sorted.forEach((row, i) => {
        peak = Math.max(peak, row.equity);
        const drawdown = r2(peak - row.equity);
        // A drawdown is only a percentage of something positive; a peak of
        // zero or less has no meaningful percent to quote.
        const drawdownPct = peak > 0 ? r2((drawdown / peak) * 100) : 0;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        if (drawdownPct > maxDrawdownPct) maxDrawdownPct = drawdownPct;

        const prev = i > 0 ? sorted[i - 1].equity : null;
        const change = prev === null ? 0 : r2(row.equity - prev);
        const changePct = prev ? r2((change / Math.abs(prev)) * 100) : null;
        if (i > 0) {
            if (!best || change > best.change) best = { day: row.day, change };
            if (!worst || change < worst.change) worst = { day: row.day, change };
        }

        points.push({ ...row, peak: r2(peak), drawdown, drawdownPct, change, changePct });
    });

    const startEquity = sorted.length ? sorted[0].equity : 0;
    const endEquity = sorted.length ? sorted[sorted.length - 1].equity : 0;

    return {
        points,
        startEquity: r2(startEquity),
        endEquity: r2(endEquity),
        change: r2(endEquity - startEquity),
        changePct: startEquity > 0 ? r2(((endEquity - startEquity) / startEquity) * 100) : null,
        peakEquity: sorted.length ? r2(Math.max(...sorted.map(s => s.equity))) : 0,
        maxDrawdown,
        maxDrawdownPct,
        bestDay: best,
        worstDay: worst,
        tradingDays: sorted.filter(s => s.trades > 0).length,
        trades: sorted.reduce((s, r) => s + (r.trades || 0), 0),
        realised: r2(sorted.reduce((s, r) => s + (r.realised || 0), 0)),
    };
}

export interface MonthRow {
    /** YYYY-MM */
    month: string;
    startEquity: number;
    endEquity: number;
    change: number;
    changePct: number | null;
    realised: number;
    trades: number;
    days: number;
}

/**
 * Month by month. The opening equity of a month is the closing equity of
 * the previous one where there is one — otherwise a month that began
 * mid-way would report the day's move as the month's.
 */
export function monthlyReturns(rows: SnapshotRow[]): MonthRow[] {
    const sorted = [...rows].sort((a, b) => a.day.localeCompare(b.day));
    const byMonth = new Map<string, SnapshotRow[]>();
    for (const row of sorted) {
        const key = row.day.slice(0, 7);
        if (!byMonth.has(key)) byMonth.set(key, []);
        byMonth.get(key)!.push(row);
    }

    const out: MonthRow[] = [];
    let previousClose: number | null = null;
    for (const [month, list] of byMonth) {
        const open = previousClose ?? list[0].equity;
        const close = list[list.length - 1].equity;
        out.push({
            month,
            startEquity: r2(open),
            endEquity: r2(close),
            change: r2(close - open),
            changePct: open > 0 ? r2(((close - open) / open) * 100) : null,
            realised: r2(list.reduce((s, r) => s + (r.realised || 0), 0)),
            trades: list.reduce((s, r) => s + (r.trades || 0), 0),
            days: list.length,
        });
        previousClose = close;
    }
    return out;
}

/** UTC calendar day of a timestamp, as YYYY-MM-DD. */
export function utcDay(ts: number | Date): string {
    return new Date(ts).toISOString().slice(0, 10);
}
