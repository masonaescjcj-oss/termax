/**
 * BINANCE MARKET FEED — crypto only.
 *
 * Uses the bookTicker stream, which pushes real best bid/ask on every change,
 * rather than the `ticker/price` REST endpoint the old code polled every 10
 * seconds for a single mid price. Candles come from /klines.
 *
 * REST is kept only as a seed on subscribe and as a fallback when the socket
 * is down, so a chart never opens empty.
 */

import axios from 'axios';
import WebSocket from 'ws';
import { AssetClass } from '../../config/instruments';
import { setQuote, setMidPrice } from '../pricing';
import { Candle, FeedStatus, MarketFeed, QuoteListener, Timeframe } from './types';

const REST_MIRRORS = [
    'https://api.binance.com/api/v3',
    'https://api1.binance.com/api/v3',
    'https://api2.binance.com/api/v3',
    'https://api3.binance.com/api/v3',
    'https://api.binance.us/api/v3',
];

const WS_BASE = 'wss://stream.binance.com:9443/stream';

const KLINE_INTERVAL: Record<Timeframe, string> = {
    '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
    '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w',
};

/** "BTC/USDT" -> "BTCUSDT" */
const toBinance = (symbol: string) => symbol.replace(/[\/\-]/g, '').toUpperCase();

export class BinanceFeed implements MarketFeed {
    readonly name = 'binance';
    readonly handles: AssetClass[] = ['CRYPTO'];

    private ws: WebSocket | null = null;
    private subscribed = new Set<string>();
    /** Binance symbol -> our symbol, for routing stream messages back. */
    private reverse = new Map<string, string>();
    private lastQuoteAt: number | null = null;
    private lastError: string | undefined;
    private mirrorIndex = 0;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private reconnectAttempt = 0;
    private closing = false;

    constructor(private readonly onQuote?: QuoteListener) {}

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    async start(): Promise<void> {
        this.closing = false;
        // The socket only opens once there is something to stream.
        if (this.subscribed.size) this.openSocket();
    }

    async stop(): Promise<void> {
        this.closing = true;
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
        this.subscribed.clear();
        this.reverse.clear();
        try { this.ws?.close(); } catch { /* already closed */ }
        this.ws = null;
    }

    supports(symbol: string): boolean {
        // Anything quoted against USDT/USD/BTC is a Binance pair.
        return /\/(USDT|USD|BTC)$/i.test(symbol);
    }

    async subscribe(symbols: string[]): Promise<void> {
        const added: string[] = [];
        for (const s of symbols) {
            if (!this.supports(s) || this.subscribed.has(s)) continue;
            this.subscribed.add(s);
            this.reverse.set(toBinance(s), s);
            added.push(s);
        }
        if (!added.length) return;

        // Seed immediately so the UI has a price before the first stream tick.
        await Promise.all(added.map(s => this.seedFromRest(s)));

        // The combined stream is specified in the URL, so changing the symbol
        // set means reopening the socket.
        this.openSocket();
    }

    async unsubscribe(symbols: string[]): Promise<void> {
        let changed = false;
        for (const s of symbols) {
            if (this.subscribed.delete(s)) {
                this.reverse.delete(toBinance(s));
                changed = true;
            }
        }
        if (!changed) return;
        if (this.subscribed.size === 0) {
            try { this.ws?.close(); } catch { /* already closed */ }
            this.ws = null;
        } else {
            this.openSocket();
        }
    }

    private streamUrl(): string {
        const streams = Array.from(this.subscribed)
            .map(s => `${toBinance(s).toLowerCase()}@bookTicker`)
            .join('/');
        return `${WS_BASE}?streams=${streams}`;
    }

    private openSocket(): void {
        if (this.closing || this.subscribed.size === 0) return;

        // Close any existing socket first — the stream list is in the URL.
        const previous = this.ws;
        this.ws = null;
        try { previous?.close(); } catch { /* already closed */ }

        const url = this.streamUrl();
        const ws = new WebSocket(url);
        this.ws = ws;

        ws.on('open', () => {
            this.reconnectAttempt = 0;
            this.lastError = undefined;
            console.log(`📡 [Binance] Streaming ${this.subscribed.size} symbol(s).`);
        });

        ws.on('message', (raw: WebSocket.RawData) => this.handleMessage(raw));

        ws.on('close', () => {
            if (this.ws === ws) this.ws = null;
            this.scheduleReconnect('socket closed');
        });

        ws.on('error', (e: Error) => {
            this.lastError = e.message;
            // 'close' fires after 'error', so reconnect is armed there.
        });
    }

    private scheduleReconnect(reason: string): void {
        if (this.closing || this.reconnectTimer || this.subscribed.size === 0) return;

        const delay = Math.min(30_000, 1_000 * Math.pow(2, this.reconnectAttempt));
        this.reconnectAttempt++;
        console.warn(`[Binance] Reconnecting in ${Math.round(delay / 1000)}s (${reason}).`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.openSocket();
        }, delay);
    }

    private handleMessage(raw: WebSocket.RawData): void {
        let payload: any;
        try {
            payload = JSON.parse(raw.toString());
        } catch {
            return;
        }

        // Combined streams wrap the payload in { stream, data }.
        const data = payload?.data ?? payload;
        const binanceSymbol = data?.s;
        if (!binanceSymbol) return;

        const ourSymbol = this.reverse.get(String(binanceSymbol).toUpperCase());
        if (!ourSymbol) return;

        const bid = Number(data.b);
        const ask = Number(data.a);
        if (!(bid > 0) || !(ask > 0)) return;

        const ts = Date.now();
        try {
            setQuote(ourSymbol, bid, ask, ts);
        } catch {
            return;
        }
        this.lastQuoteAt = ts;
        this.onQuote?.({ symbol: ourSymbol, bid, ask, ts });
    }

    /** One-shot REST seed so a symbol is priced the moment it is subscribed. */
    private async seedFromRest(symbol: string): Promise<void> {
        const bSymbol = toBinance(symbol);
        for (let i = 0; i < REST_MIRRORS.length; i++) {
            const base = REST_MIRRORS[(this.mirrorIndex + i) % REST_MIRRORS.length];
            try {
                const res = await axios.get(`${base}/ticker/bookTicker`, {
                    params: { symbol: bSymbol },
                    timeout: 4000,
                });
                const bid = Number(res.data?.bidPrice);
                const ask = Number(res.data?.askPrice);
                if (bid > 0 && ask > 0) {
                    this.mirrorIndex = (this.mirrorIndex + i) % REST_MIRRORS.length;
                    setQuote(symbol, bid, ask);
                    this.lastQuoteAt = Date.now();
                    return;
                }
            } catch { /* try the next mirror */ }
        }

        // Last resort: a mid price, widened by the instrument's typical spread.
        for (let i = 0; i < REST_MIRRORS.length; i++) {
            const base = REST_MIRRORS[(this.mirrorIndex + i) % REST_MIRRORS.length];
            try {
                const res = await axios.get(`${base}/ticker/price`, {
                    params: { symbol: bSymbol }, timeout: 4000,
                });
                const price = Number(res.data?.price);
                if (price > 0) { setMidPrice(symbol, price); return; }
            } catch { /* try the next mirror */ }
        }

        this.lastError = `could not seed ${symbol} from any mirror`;
    }

    async getCandles(symbol: string, timeframe: Timeframe, limit: number): Promise<Candle[] | null> {
        if (!this.supports(symbol)) return null;
        const interval = KLINE_INTERVAL[timeframe];
        if (!interval) return null;

        const bSymbol = toBinance(symbol);
        for (let i = 0; i < REST_MIRRORS.length; i++) {
            const base = REST_MIRRORS[(this.mirrorIndex + i) % REST_MIRRORS.length];
            try {
                const res = await axios.get(`${base}/klines`, {
                    params: { symbol: bSymbol, interval, limit: Math.min(limit, 1000) },
                    timeout: 5000,
                });
                if (Array.isArray(res.data) && res.data.length) {
                    this.mirrorIndex = (this.mirrorIndex + i) % REST_MIRRORS.length;
                    return res.data.map((k: any[]) => ({
                        time: Number(k[0]),
                        open: parseFloat(k[1]),
                        high: parseFloat(k[2]),
                        low: parseFloat(k[3]),
                        close: parseFloat(k[4]),
                        volume: parseFloat(k[5]),
                    }));
                }
            } catch { /* try the next mirror */ }
        }
        return null;
    }

    async getCandlesRange(symbol: string, timeframe: Timeframe, fromMs: number, toMs: number): Promise<Candle[] | null> {
        if (!this.supports(symbol)) return null;
        const interval = KLINE_INTERVAL[timeframe];
        if (!interval) return null;

        const bSymbol = toBinance(symbol);
        for (let i = 0; i < REST_MIRRORS.length; i++) {
            const base = REST_MIRRORS[(this.mirrorIndex + i) % REST_MIRRORS.length];
            try {
                const res = await axios.get(`${base}/klines`, {
                    params: {
                        symbol: bSymbol, interval,
                        startTime: Math.floor(fromMs),
                        endTime: Math.floor(toMs) - 1,
                        limit: 1000,
                    },
                    timeout: 8000,
                });
                if (Array.isArray(res.data)) {
                    this.mirrorIndex = (this.mirrorIndex + i) % REST_MIRRORS.length;
                    return res.data.map((k: any[]) => ({
                        time: Number(k[0]),
                        open: parseFloat(k[1]),
                        high: parseFloat(k[2]),
                        low: parseFloat(k[3]),
                        close: parseFloat(k[4]),
                        volume: parseFloat(k[5]),
                    }));
                }
            } catch { /* try the next mirror */ }
        }
        return null;
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
