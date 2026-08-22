/**
 * MARKET FEED CONTRACT
 *
 * The engine reads prices from services/pricing.ts and never talks to a data
 * provider directly. A feed's only job is to push quotes into that store and
 * to answer candle requests. That keeps the provider swappable: forex comes
 * from the broker's own cTrader feed, crypto from Binance, and either can be
 * replaced without touching execution.
 */

import { AssetClass } from '../../config/instruments';

export interface FeedQuote {
    symbol: string;
    bid: number;
    ask: number;
    /** ms epoch reported by the provider, or arrival time if it gives none. */
    ts: number;
}

export interface Candle {
    /** Bar open time, ms epoch. */
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/** Chart timeframes the app offers, in provider-neutral form. */
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

export interface FeedStatus {
    name: string;
    connected: boolean;
    /** Symbols this feed is currently streaming. */
    subscribed: string[];
    /** ms epoch of the last quote received from this provider. */
    lastQuoteAt: number | null;
    /** Populated when the feed is down or degraded. */
    error?: string;
}

export interface MarketFeed {
    /** Stable identifier used in logs and the status endpoint. */
    readonly name: string;

    /** Asset classes this feed is responsible for. */
    readonly handles: AssetClass[];

    /** Connect and authenticate. Must be safe to call more than once. */
    start(): Promise<void>;

    /** Disconnect and clear timers. Must be safe to call when not started. */
    stop(): Promise<void>;

    /** True when the feed can currently serve quotes. */
    isConnected(): boolean;

    /**
     * Whether this feed can actually serve a symbol. A feed may handle an
     * asset class in general but not carry a particular instrument — the
     * router uses this to fall back rather than leaving a symbol unpriced.
     */
    supports(symbol: string): boolean;

    /** Begin streaming these symbols. Idempotent per symbol. */
    subscribe(symbols: string[]): Promise<void>;

    /** Stop streaming these symbols. */
    unsubscribe(symbols: string[]): Promise<void>;

    /**
     * Historical candles, oldest first. Returns null when this feed cannot
     * serve the request, so the router can try another provider.
     */
    getCandles(symbol: string, timeframe: Timeframe, limit: number): Promise<Candle[] | null>;

    status(): FeedStatus;
}

/** Emitted to subscribers of the router so sockets can fan quotes out. */
export type QuoteListener = (quote: FeedQuote) => void;
