/**
 * Trade statistics shared by the forward-test report and the "bot vs you"
 * comparison — one formula set, so the two columns are always comparable.
 */

export interface TradeLike {
    finalProfit?: number | null;
    openTime?: Date | string | null;
    closeTime?: Date | string | null;
}

export interface TradeStats {
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    netProfit: number;
    grossProfit: number;
    grossLoss: number;
    profitFactor: number | null;
    expectancy: number;
    /** Worst peak-to-trough of the cumulative net P/L, in account currency. */
    maxDrawdown: number;
    avgHoldMinutes: number;
    firstTradeAt: number | null;
    lastTradeAt: number | null;
}

export function computeTradeStats(closed: TradeLike[]): TradeStats {
    const rows = closed
        .map(p => ({
            net: Number(p.finalProfit ?? 0),
            openMs: p.openTime ? new Date(p.openTime).getTime() : NaN,
            closeMs: p.closeTime ? new Date(p.closeTime).getTime() : NaN,
        }))
        .sort((a, b) => (a.closeMs || 0) - (b.closeMs || 0));

    let grossProfit = 0;
    let grossLoss = 0;
    let cum = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let holdSum = 0;
    let holdCount = 0;

    for (const r of rows) {
        if (r.net > 0) grossProfit += r.net;
        else grossLoss += -r.net;
        cum += r.net;
        if (cum > peak) peak = cum;
        if (peak - cum > maxDrawdown) maxDrawdown = peak - cum;
        if (Number.isFinite(r.openMs) && Number.isFinite(r.closeMs) && r.closeMs >= r.openMs) {
            holdSum += (r.closeMs - r.openMs) / 60_000;
            holdCount++;
        }
    }

    const wins = rows.filter(r => r.net > 0).length;
    const netProfit = grossProfit - grossLoss;
    return {
        trades: rows.length,
        wins,
        losses: rows.length - wins,
        winRate: rows.length ? (wins / rows.length) * 100 : 0,
        netProfit,
        grossProfit,
        grossLoss,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? null : 0),
        expectancy: rows.length ? netProfit / rows.length : 0,
        maxDrawdown,
        avgHoldMinutes: holdCount ? holdSum / holdCount : 0,
        firstTradeAt: rows.length && Number.isFinite(rows[0].closeMs) ? rows[0].closeMs : null,
        lastTradeAt: rows.length && Number.isFinite(rows[rows.length - 1].closeMs) ? rows[rows.length - 1].closeMs : null,
    };
}
