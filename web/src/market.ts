/**
 * Live quotes over the backend's socket.io feed, shared by every part of
 * the terminal. One socket, one `subscribe` per symbol, and a small store
 * components subscribe to — the chart, the watchlist and the positions
 * table all read the same tick.
 */

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { BASE, TOKEN_KEY } from './api';

export interface Quote {
    symbol: string;
    price: number;
    bid: number;
    ask: number;
    spread: number;
    /** ms since epoch */
    ts: number;
    /** Set on the client: previous mid, for tick colouring. */
    prev: number | null;
}

type Listener = (quote: Quote) => void;

const quotes = new Map<string, Quote>();
const listeners = new Map<string, Set<Listener>>();
const wanted = new Map<string, number>();
let socket: Socket | null = null;
let connected = false;
const statusListeners = new Set<(up: boolean) => void>();

function ensureSocket(): Socket {
    if (socket) return socket;
    socket = io(BASE || undefined, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 8000,
    });
    socket.on('connect', () => {
        connected = true;
        statusListeners.forEach(fn => fn(true));
        const symbols = [...wanted.keys()];
        if (symbols.length) socket!.emit('subscribe', { symbols });
        joinUserRoom();
    });
    // Private events for the signed-in trader: fills, closes, stop-outs and
    // notifications. The server verifies the token before joining the room.
    for (const ev of ['positionOpened', 'positionClosed', 'stopOut', 'notification'] as const) {
        socket.on(ev, (payload: any) => userListeners.forEach(fn => fn(ev, payload)));
    }
    socket.on('disconnect', () => {
        connected = false;
        statusListeners.forEach(fn => fn(false));
    });
    socket.on('priceUpdate', (raw: any) => {
        if (!raw || typeof raw.symbol !== 'string') return;
        const price = Number(raw.price);
        if (!Number.isFinite(price)) return;
        const old = quotes.get(raw.symbol);
        const quote: Quote = {
            symbol: raw.symbol,
            price,
            bid: Number.isFinite(Number(raw.bid)) ? Number(raw.bid) : price,
            ask: Number.isFinite(Number(raw.ask)) ? Number(raw.ask) : price,
            spread: Number(raw.spread) || 0,
            ts: raw.timestamp ? new Date(raw.timestamp).getTime() : Date.now(),
            prev: old ? old.price : null,
        };
        quotes.set(raw.symbol, quote);
        listeners.get(raw.symbol)?.forEach(fn => fn(quote));
        listeners.get('*')?.forEach(fn => fn(quote));
    });
    return socket;
}

export function isConnected() { return connected; }

type UserEvent = 'positionOpened' | 'positionClosed' | 'stopOut' | 'notification';
const userListeners = new Set<(ev: UserEvent, payload: any) => void>();
let joinedToken = '';

function joinUserRoom() {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!socket?.connected) return;
    if (!token) { if (joinedToken) socket.emit('leaveUserRoom'); joinedToken = ''; return; }
    socket.emit('joinUserRoom', { token });
    joinedToken = token;
}

/** Call after sign-in/out so the private room follows the session. */
export function syncUserRoom() {
    ensureSocket();
    if ((localStorage.getItem(TOKEN_KEY) || '') !== joinedToken) joinUserRoom();
}

/** Subscribe to the signed-in trader's private events. */
export function onUserEvent(fn: (ev: UserEvent, payload: any) => void) {
    ensureSocket();
    syncUserRoom();
    userListeners.add(fn);
    return () => { userListeners.delete(fn); };
}

/** Open the feed socket without subscribing — so the status light is honest on pages without a chart. */
export function connectFeed() { ensureSocket(); }

export function onStatus(fn: (up: boolean) => void) {
    statusListeners.add(fn);
    fn(connected);
    return () => { statusListeners.delete(fn); };
}

export function getQuote(symbol: string): Quote | undefined {
    return quotes.get(symbol);
}

/** Subscribe to a symbol's ticks. Returns an unsubscribe function. */
export function watch(symbol: string, fn: Listener): () => void {
    const s = ensureSocket();
    if (!listeners.has(symbol)) listeners.set(symbol, new Set());
    listeners.get(symbol)!.add(fn);

    if (symbol !== '*') {
        const n = (wanted.get(symbol) ?? 0) + 1;
        wanted.set(symbol, n);
        if (n === 1 && s.connected) s.emit('subscribe', { symbol });
        const cached = quotes.get(symbol);
        if (cached) fn(cached);
    }

    return () => {
        listeners.get(symbol)?.delete(fn);
        if (symbol === '*') return;
        const n = (wanted.get(symbol) ?? 1) - 1;
        if (n <= 0) {
            wanted.delete(symbol);
            // Leave the room a little later: a symbol switch usually
            // resubscribes the same symbol from another component.
            setTimeout(() => {
                if (!wanted.has(symbol) && socket?.connected) socket.emit('unsubscribe', { symbol });
            }, 3000);
        } else {
            wanted.set(symbol, n);
        }
    };
}

/** React hook: the latest quote for one symbol. */
export function useQuote(symbol: string | null | undefined): Quote | undefined {
    const [quote, setQuote] = useState<Quote | undefined>(symbol ? quotes.get(symbol) : undefined);
    useEffect(() => {
        if (!symbol) { setQuote(undefined); return; }
        setQuote(quotes.get(symbol));
        return watch(symbol, setQuote);
    }, [symbol]);
    return quote;
}

/** React hook: quotes for a list of symbols, re-rendering on any tick. */
export function useQuotes(symbols: string[]): Record<string, Quote> {
    const key = symbols.join('|');
    const [, bump] = useState(0);
    useEffect(() => {
        const offs = symbols.map(s => watch(s, () => bump(n => n + 1)));
        return () => offs.forEach(off => off());
    }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
    const out: Record<string, Quote> = {};
    for (const s of symbols) {
        const qt = quotes.get(s);
        if (qt) out[s] = qt;
    }
    return out;
}

export function useFeedStatus(): boolean {
    const [up, setUp] = useState(connected);
    useEffect(() => onStatus(setUp), []);
    return up;
}

/* ── Candles ─────────────────────────────────────────────────────────── */

export interface Candle {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] as const;
export type Timeframe = typeof TIMEFRAMES[number];

export const TF_MS: Record<Timeframe, number> = {
    '1m': 60_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000,
    '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000, '1w': 604_800_000,
};

export async function fetchCandles(symbol: string, interval: Timeframe, limit = 500): Promise<Candle[]> {
    const path = `${BASE}/api/v1/market/candles/${encodeURIComponent(symbol.replace('/', '-'))}?interval=${interval}&limit=${limit}`;
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Candles ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    return rows
        .map((c: any) => ({
            timestamp: new Date(c.timestamp).getTime(),
            open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close),
            volume: Number(c.volume) || 0,
        }))
        .filter(c => Number.isFinite(c.timestamp) && Number.isFinite(c.close))
        .sort((a, b) => a.timestamp - b.timestamp);
}
