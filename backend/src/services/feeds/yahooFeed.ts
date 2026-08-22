/**
 * YAHOO FINANCE FEED — stocks, and a fallback for anything the broker does
 * not offer.
 *
 * Yahoo publishes a single delayed price, not a tradable two-sided quote, so
 * every quote here is synthesised from the instrument's typical spread and is
 * explicitly second-best. Forex, metals and indices should come from the
 * broker's cTrader feed; this exists so an instrument is never left unpriced.
 */

import YahooFinance from 'yahoo-finance2';
import { AssetClass, getSpec } from '../../config/instruments';
import { setMidPrice } from '../pricing';
import { Candle, FeedStatus, MarketFeed, QuoteListener, Timeframe } from './types';

const yahooFinance = new YahooFinance();

/** Poll interval. Yahoo data is delayed, so faster polling buys nothing. */
const POLL_MS = 10_000;

/** Our symbol -> Yahoo ticker. */
const TICKERS: Record<string, string> = {
    GOLD: 'GC=F', SILVER: 'SI=F', USOIL: 'CL=F',
    SPX: '^GSPC', NDQ: '^NDX', DJI: '^DJI', VIX: '^VIX', DXY: 'DX=F',
    DAX: '^GDAXI', FTSE: '^FTSE', N225: '^N225',
};

const CHART_INTERVAL: Partial<Record<Timeframe, string>> = {
    '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
    '1h': '1h', '1d': '1d', '1w': '1wk',
};

function toTicker(symbol: string): string {
    if (TICKERS[symbol]) return TICKERS[symbol];
    if (symbol.includes('/USDT')) return symbol.replace('/USDT', '-USD');
    if (symbol.includes('/')) return symbol.replace('/', '') + '=X';
    return symbol;
}

export class YahooFeed implements MarketFeed {
    readonly name = 'yahoo';
    // Listed last in the router, so it only picks up what the broker misses.
    readonly handles: AssetClass[] = ['STOCK', 'INDEX', 'METAL', 'ENERGY', 'FOREX'];

    private subscribed = new Set<string>();
    private timer: NodeJS.Timeout | null = null;
    private lastQuoteAt: number | null = null;
    private lastError: string | undefined;

    constructor(private readonly onQuote?: QuoteListener) {}

    isConnected(): boolean {
        // Stateless HTTP: treat "polling" as connected.
        return this.timer !== null;
    }

    async start(): Promise<void> {
        if (this.timer) return;
        this.timer = setInterval(() => { void this.poll(); }, POLL_MS);
    }

    async stop(): Promise<void> {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        this.subscribed.clear();
    }

    supports(): boolean {
        // Yahoo covers a very wide universe; let the router's ordering decide.
        return true;
    }

    async subscribe(symbols: string[]): Promise<void> {
        let added = false;
        for (const s of symbols) {
            if (!this.subscribed.has(s)) { this.subscribed.add(s); added = true; }
        }
        await this.start();
        if (added) await this.poll();
    }

    async unsubscribe(symbols: string[]): Promise<void> {
        for (const s of symbols) this.subscribed.delete(s);
    }

    private async poll(): Promise<void> {
        const symbols = Array.from(this.subscribed);
        if (!symbols.length) return;

        // Yahoo rejects very large batches, so chunk the request.
        for (let i = 0; i < symbols.length; i += 10) {
            const chunk = symbols.slice(i, i + 10);
            const tickerToSymbol = new Map(chunk.map(s => [toTicker(s), s]));
            try {
                const quotes = await yahooFinance.quote(Array.from(tickerToSymbol.keys()));
                for (const q of quotes as any[]) {
                    const ourSymbol = tickerToSymbol.get(q.symbol);
                    if (!ourSymbol) continue;

                    // Prefer a real two-sided quote when Yahoo has one.
                    const bid = Number(q.bid);
                    const ask = Number(q.ask);
                    const mid = Number(q.regularMarketPrice);

                    try {
                        if (bid > 0 && ask > 0 && ask >= bid) {
                            const { setQuote } = require('../pricing') as typeof import('../pricing');
                            setQuote(ourSymbol, bid, ask);
                            this.onQuote?.({ symbol: ourSymbol, bid, ask, ts: Date.now() });
                        } else if (mid > 0) {
                            const quote = setMidPrice(ourSymbol, mid);
                            this.onQuote?.({ symbol: ourSymbol, bid: quote.bid, ask: quote.ask, ts: quote.ts });
                        } else {
                            continue;
                        }
                        this.lastQuoteAt = Date.now();
                        this.lastError = undefined;
                    } catch { /* quote store rejected it */ }
                }
            } catch (e: any) {
                this.lastError = e.message;
            }
        }
    }

    async getCandles(symbol: string, timeframe: Timeframe, limit: number): Promise<Candle[] | null> {
        const interval = CHART_INTERVAL[timeframe];
        if (!interval) return null;

        const spec = getSpec(symbol);
        // Yahoo caps intraday history, so bound the window by timeframe.
        const days = timeframe === '1d' || timeframe === '1w' ? 3650
            : timeframe === '1h' ? 60 : 7;
        const period1 = new Date(Date.now() - days * 86_400_000);

        try {
            const res: any = await yahooFinance.chart(toTicker(symbol), { period1, interval: interval as any });
            const rows: any[] = res?.quotes ?? [];
            const candles = rows
                .filter(r => r && r.open != null && r.close != null)
                .map(r => ({
                    time: new Date(r.date).getTime(),
                    open: Number(r.open),
                    high: Number(r.high),
                    low: Number(r.low),
                    close: Number(r.close),
                    volume: Number(r.volume ?? 0),
                }));
            if (!candles.length) return null;
            void spec;
            return candles.slice(-limit);
        } catch (e: any) {
            console.warn(`[Yahoo] Candles for ${symbol} ${timeframe} failed:`, e.message);
            return null;
        }
    }

    status(): FeedStatus {
        return {
            name: this.name,
            connected: this.isConnected(),
            subscribed: Array.from(this.subscribed),
            lastQuoteAt: this.lastQuoteAt,
            error: this.lastError,
        };
    }
}
