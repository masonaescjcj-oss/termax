/**
 * Position maths for the client.
 *
 * This replaces four hand-copied `pnlMultipliers` / `contractSizes` tables
 * that had drifted apart across PositionsScreen and ChartScreen. None of them
 * contained a single forex pair, so every forex lookup fell through to a
 * multiplier of 1 and a 1.00 lot EUR/USD position showed a P/L of $0.005
 * instead of $500.
 *
 * The server is the authority: `/api/v1/trade/positions` now ships the
 * contract terms with each position (`contractSize`, `quoteRate`, `pipValue`,
 * `marginUsed`), so the client can revalue on every tick without keeping its
 * own contract-size or FX tables. When those fields are absent — an older
 * server, or a currency the server could not convert — we fall back to the
 * server's own `unrealizedPnL` rather than computing a number we know would
 * be wrong.
 */

export interface PositionTerms {
    symbol: string;
    side: 'BUY' | 'SELL';
    volume: number;
    entryPrice: number;
    commission?: number;
    swap?: number;
    /** Units of the base currency per lot, from the server. */
    contractSize?: number | null;
    /** Quote currency -> account currency rate, from the server. */
    quoteRate?: number | null;
    /** Money value of one pip for this position's volume. */
    pipValue?: number | null;
    /** Margin the server has reserved for this position. */
    marginUsed?: number | null;
    /** Last P/L the server calculated — the fallback, and the source of truth. */
    unrealizedPnL?: number | null;
    /** Price the position would close at, per the server. */
    marketPrice?: number | null;
    digits?: number | null;
}

/** True when the server gave us everything needed to revalue locally. */
export function canRevalue(pos: PositionTerms): boolean {
    return (
        typeof pos.contractSize === 'number' && pos.contractSize > 0 &&
        typeof pos.quoteRate === 'number' && pos.quoteRate > 0
    );
}

/**
 * Recompute floating P/L against a fresh price, in account currency.
 *
 * `marketPrice` must be the side of the book the position closes at — the bid
 * for a long, the ask for a short. Pass `quote.bid` / `quote.ask` from the
 * priceUpdate payload when available; the mid is only an approximation.
 *
 * Returns the server's last value when the contract terms are missing, and
 * null when there is nothing trustworthy to show.
 */
export function revaluePnL(pos: PositionTerms, marketPrice: number): number | null {
    if (!canRevalue(pos) || !(marketPrice > 0)) {
        return typeof pos.unrealizedPnL === 'number' ? pos.unrealizedPnL : null;
    }
    const move = pos.side === 'BUY'
        ? marketPrice - pos.entryPrice
        : pos.entryPrice - marketPrice;
    const gross = move * pos.volume * (pos.contractSize as number) * (pos.quoteRate as number);
    return gross - (pos.commission || 0) + (pos.swap || 0);
}

/**
 * Pick the price a position is marked against out of a priceUpdate payload.
 * Falls back to the mid when the feed is one-sided.
 */
export function markPrice(
    side: 'BUY' | 'SELL',
    tick: { price?: number; bid?: number | null; ask?: number | null }
): number | undefined {
    const closeSide = side === 'BUY' ? tick.bid : tick.ask;
    if (typeof closeSide === 'number' && closeSide > 0) return closeSide;
    return typeof tick.price === 'number' && tick.price > 0 ? tick.price : undefined;
}

/** Total floating P/L across positions, skipping any that cannot be valued. */
export function totalPnL(positions: PositionTerms[]): number {
    return positions.reduce((sum, p) => {
        const v = typeof p.unrealizedPnL === 'number' ? p.unrealizedPnL : 0;
        return sum + v;
    }, 0);
}

/**
 * Total margin in use. Uses the server's per-position figure — the client
 * previously recomputed it as `volume * contractSize * entryPrice / 200`,
 * which was wrong for forex (contract size 1) and for every instrument whose
 * margin is charged on the base currency rather than the quoted price.
 */
export function totalMargin(positions: PositionTerms[]): number {
    return positions.reduce(
        (sum, p) => sum + (typeof p.marginUsed === 'number' ? p.marginUsed : 0),
        0
    );
}

/** Format a price at the instrument's own precision. */
export function formatPrice(pos: PositionTerms, price: number): string {
    const digits = typeof pos.digits === 'number' ? pos.digits : 2;
    return price.toFixed(digits);
}

/** Money change implied by moving a stop or target to `price`. */
export function pnlAtPrice(pos: PositionTerms, price: number): number | null {
    return revaluePnL(pos, price);
}
