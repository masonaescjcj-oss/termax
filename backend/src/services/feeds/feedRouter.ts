/**
 * FEED ROUTER
 *
 * Decides which provider serves each symbol and gives the rest of the app one
 * place to subscribe and to fetch candles. Both trading modes share it: the
 * simulator and live cTrader execution price off exactly the same quotes.
 *
 * Routing: forex, metals, energy and indices go to the broker's cTrader feed;
 * crypto goes to Binance. Yahoo remains a fallback for stocks and for any
 * instrument the broker does not offer, so nothing silently goes unpriced.
 */

import { AssetClass, getSpec } from '../../config/instruments';
import { Candle, FeedQuote, FeedStatus, MarketFeed, QuoteListener, Timeframe } from './types';

export class FeedRouter {
    private feeds: MarketFeed[] = [];
    private listeners = new Set<QuoteListener>();
    /** Which feed each symbol was routed to, for unsubscribe and diagnostics. */
    private routed = new Map<string, MarketFeed>();

    /** Register feeds in priority order — the first that supports a symbol wins. */
    register(feed: MarketFeed): void {
        this.feeds.push(feed);
    }

    onQuote(listener: QuoteListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /** Feeds call this; the router fans out to sockets and anything else. */
    publish(quote: FeedQuote): void {
        for (const l of this.listeners) {
            try {
                l(quote);
            } catch (e: any) {
                console.error('[Feed] Quote listener threw:', e.message);
            }
        }
    }

    async start(): Promise<void> {
        for (const feed of this.feeds) {
            try {
                await feed.start();
            } catch (e: any) {
                // One provider being down must not stop the others.
                console.error(`[Feed] ${feed.name} failed to start:`, e.message);
            }
        }
    }

    async stop(): Promise<void> {
        for (const feed of this.feeds) {
            try {
                await feed.stop();
            } catch { /* best effort */ }
        }
        this.routed.clear();
    }

    /**
     * Pick the feed for a symbol: a connected feed that both handles the asset
     * class and actually carries the instrument, else any feed that carries it.
     */
    private pick(symbol: string): MarketFeed | undefined {
        const assetClass: AssetClass = getSpec(symbol).assetClass;

        const byClass = this.feeds.filter(f => f.handles.includes(assetClass));
        const preferred = byClass.find(f => f.isConnected() && f.supports(symbol))
            ?? byClass.find(f => f.supports(symbol));
        if (preferred) return preferred;

        // The broker may not offer this instrument; let any feed that carries
        // it take over rather than leaving the symbol unpriced.
        return this.feeds.find(f => f.isConnected() && f.supports(symbol))
            ?? this.feeds.find(f => f.supports(symbol));
    }

    async subscribe(symbols: string[]): Promise<void> {
        const byFeed = new Map<MarketFeed, string[]>();
        const unroutable: string[] = [];

        for (const symbol of symbols) {
            const existing = this.routed.get(symbol);
            if (existing && existing.isConnected()) continue;

            const feed = this.pick(symbol);
            if (!feed) { unroutable.push(symbol); continue; }

            this.routed.set(symbol, feed);
            const list = byFeed.get(feed) ?? [];
            list.push(symbol);
            byFeed.set(feed, list);
        }

        if (unroutable.length) {
            console.warn(`[Feed] No provider for: ${unroutable.join(', ')}`);
        }

        await Promise.all(
            Array.from(byFeed.entries()).map(async ([feed, list]) => {
                try {
                    await feed.subscribe(list);
                } catch (e: any) {
                    console.error(`[Feed] ${feed.name} subscribe failed for ${list.join(', ')}:`, e.message);
                    for (const s of list) this.routed.delete(s);
                }
            })
        );
    }

    async unsubscribe(symbols: string[]): Promise<void> {
        const byFeed = new Map<MarketFeed, string[]>();
        for (const symbol of symbols) {
            const feed = this.routed.get(symbol);
            if (!feed) continue;
            this.routed.delete(symbol);
            const list = byFeed.get(feed) ?? [];
            list.push(symbol);
            byFeed.set(feed, list);
        }
        await Promise.all(
            Array.from(byFeed.entries()).map(([feed, list]) =>
                feed.unsubscribe(list).catch(() => undefined)
            )
        );
    }

    /**
     * Candles for a symbol, trying the routed feed first and then any other
     * that can serve it. Returns null only when no provider can.
     */
    async getCandles(symbol: string, timeframe: Timeframe, limit: number): Promise<Candle[] | null> {
        const first = this.pick(symbol);
        const order = [first, ...this.feeds.filter(f => f !== first)].filter(Boolean) as MarketFeed[];

        for (const feed of order) {
            if (!feed.supports(symbol)) continue;
            try {
                const candles = await feed.getCandles(symbol, timeframe, limit);
                if (candles && candles.length) return candles;
            } catch (e: any) {
                console.warn(`[Feed] ${feed.name} candles for ${symbol} failed:`, e.message);
            }
        }
        return null;
    }

    /**
     * One page of historical candles in [fromMs, toMs) from the first feed
     * that has real history for the symbol. Null when none does.
     */
    async getCandlesRange(symbol: string, timeframe: Timeframe, fromMs: number, toMs: number): Promise<Candle[] | null> {
        const first = this.pick(symbol);
        const order = [first, ...this.feeds.filter(f => f !== first)].filter(Boolean) as MarketFeed[];
        for (const feed of order) {
            if (!feed.supports(symbol) || !feed.getCandlesRange) continue;
            try {
                const candles = await feed.getCandlesRange(symbol, timeframe, fromMs, toMs);
                if (candles) return candles;
            } catch (e: any) {
                console.warn(`[Feed] ${feed.name} candle range for ${symbol} failed:`, e.message);
            }
        }
        return null;
    }

    /** Which provider is serving a symbol — surfaced in the status endpoint. */
    providerFor(symbol: string): string | null {
        return this.routed.get(symbol)?.name ?? this.pick(symbol)?.name ?? null;
    }

    status(): { feeds: FeedStatus[]; routing: Record<string, string> } {
        const routing: Record<string, string> = {};
        for (const [symbol, feed] of this.routed) routing[symbol] = feed.name;
        return { feeds: this.feeds.map(f => f.status()), routing };
    }
}

/** Process-wide router — the sockets and controllers share one instance. */
export const feedRouter = new FeedRouter();
