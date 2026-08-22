/**
 * EXECUTION VENUE CONTRACT
 *
 * The app runs two trading modes and this interface is the seam between them:
 *
 *   SIMULATED — orders are matched by our own engine against the live feed.
 *               Balances, margin, stop-outs and swap are ours. No broker risk.
 *
 *   CTRADER   — orders are sent to the broker over the Open API and positions
 *               are read back from the account. The broker is the book of
 *               record; our engine only mirrors it.
 *
 * Both price off the same quotes (services/pricing.ts), fed by the same
 * providers, so a simulated fill and a live fill see the same market.
 *
 * The mode is a property of the account, not of the server: a user can hold a
 * simulated demo account and a live cTrader account at once, and each order
 * routes by the account it belongs to.
 */

export type VenueKind = 'SIMULATED' | 'CTRADER';

export type OrderSide = 'BUY' | 'SELL';
export type OrderKind = 'MARKET' | 'LIMIT' | 'STOP';

export interface OrderRequest {
    accountId: string;
    symbol: string;
    side: OrderSide;
    /** Lots. */
    volume: number;
    kind: OrderKind;
    /** Required for LIMIT and STOP orders. */
    targetPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    /** Distance in price units; 0 disables trailing. */
    trailingStopDistance?: number;
    /** Free-text label carried onto the broker order where supported. */
    comment?: string;
}

export interface VenuePosition {
    /** Venue-native identifier. */
    id: string;
    accountId: string;
    symbol: string;
    side: OrderSide;
    volume: number;
    entryPrice: number;
    stopLoss?: number | null;
    takeProfit?: number | null;
    commission: number;
    swap: number;
    /** Present once closed. */
    closePrice?: number | null;
    status: 'PENDING' | 'OPEN' | 'CLOSED' | 'CANCELLED';
    openTime?: Date | null;
    closeTime?: Date | null;
    /** Realised P/L once closed, in account currency. */
    finalProfit?: number | null;
}

export interface VenueAccount {
    accountId: string;
    currency: string;
    balance: number;
    equity: number;
    margin: number;
    freeMargin: number;
    marginLevel: number;
    /** Denominator of the account's leverage, e.g. 200 for 1:200. */
    leverage: number;
}

export interface ModifyRequest {
    accountId: string;
    positionId: string;
    stopLoss?: number | null;
    takeProfit?: number | null;
    trailingStopDistance?: number | null;
}

export interface CloseRequest {
    accountId: string;
    positionId: string;
    /** Partial close volume in lots; omit to close in full. */
    volume?: number;
}

export interface VenueResult<T> {
    ok: boolean;
    data?: T;
    /** User-facing reason when ok is false. */
    error?: string;
}

export interface ExecutionVenue {
    readonly kind: VenueKind;

    /** True when this venue can currently accept orders. */
    isAvailable(): boolean;

    openOrder(req: OrderRequest): Promise<VenueResult<VenuePosition>>;
    closePosition(req: CloseRequest): Promise<VenueResult<VenuePosition>>;
    modifyPosition(req: ModifyRequest): Promise<VenueResult<VenuePosition>>;

    /** Current positions for an account, including pending orders. */
    getPositions(accountId: string): Promise<VenueResult<VenuePosition[]>>;

    /** Balance, equity and margin as this venue reports them. */
    getAccount(accountId: string): Promise<VenueResult<VenueAccount>>;
}
