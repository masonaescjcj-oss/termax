/**
 * The trader's book: open/pending/closed positions plus the account
 * metrics the server computes. One poll shared by the top bar, the
 * positions table and the order ticket; anything that changes the book
 * calls `refreshBook()` so every view updates at once.
 */
import { useEffect, useState } from 'react';
import { data, q } from '../api';
import { onUserEvent } from '../market';

export interface Position {
    id: string;
    accountId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    volume: number;
    entryPrice: number;
    closePrice: number | null;
    takeProfit: number | null;
    stopLoss: number | null;
    trailingStopDistance: number;
    orderType: 'MARKET' | 'LIMIT' | 'STOP' | string;
    status: 'OPEN' | 'PENDING' | 'CLOSED' | string;
    unrealizedPnL?: number;
    finalProfit: number | null;
    swap: number;
    commission: number;
    venue: string;
    botId: string | null;
    openTime: string;
    closeTime: string | null;
    // Contract terms shipped by the server so P/L can be re-marked per tick.
    contractSize?: number;
    digits?: number;
    pipSize?: number;
    quoteRate?: number | null;
    pipValue?: number | null;
    marginUsed?: number | null;
    currentPrice?: number;
    marketPrice?: number;
}

export interface AccountState {
    accountId: string;
    balance: number;
    equity: number;
    margin: number;
    freeMargin: number;
    marginLevel: number;
    leverage: number;
}

interface Book { positions: Position[]; account: AccountState | null; loadedAt: number; error: string | null }

const books = new Map<string, Book>();
const listeners = new Map<string, Set<(b: Book) => void>>();
const inflight = new Map<string, Promise<void>>();
const pollers = new Map<string, ReturnType<typeof setInterval>>();

const emit = (accountId: string) => {
    const b = books.get(accountId);
    if (b) listeners.get(accountId)?.forEach(fn => fn(b));
};

export function refreshBook(accountId: string): Promise<void> {
    const running = inflight.get(accountId);
    if (running) return running;
    const p = (async () => {
        try {
            const res = await data<{ positions: Position[]; account: AccountState }>(q('/trade/positions', { accountId }));
            books.set(accountId, { positions: res.positions ?? [], account: res.account ?? null, loadedAt: Date.now(), error: null });
        } catch (e: any) {
            const prev = books.get(accountId);
            books.set(accountId, { positions: prev?.positions ?? [], account: prev?.account ?? null, loadedAt: prev?.loadedAt ?? 0, error: e?.message || 'Could not load positions.' });
        } finally {
            inflight.delete(accountId);
            emit(accountId);
        }
    })();
    inflight.set(accountId, p);
    return p;
}

/** Re-mark every account that has a live view. Called after fills/closes. */
export function refreshAllBooks() {
    for (const id of listeners.keys()) if (listeners.get(id)!.size) void refreshBook(id);
}

// Fills, closes and stop-outs arrive over the user room; re-pull the book
// on each so the table moves with the server, not with the 10s poll.
let wiredEvents = false;
function wireEvents() {
    if (wiredEvents) return;
    wiredEvents = true;
    onUserEvent(ev => { if (ev !== 'notification') refreshAllBooks(); });
}

function useBook(accountId: string): Book | null {
    wireEvents();
    const [book, setBook] = useState<Book | null>(books.get(accountId) ?? null);
    useEffect(() => {
        if (!listeners.has(accountId)) listeners.set(accountId, new Set());
        const set = listeners.get(accountId)!;
        set.add(setBook);
        setBook(books.get(accountId) ?? null);
        void refreshBook(accountId);
        // The server re-marks P/L on its own tick; 10s keeps the account
        // strip honest without the 2-second poll that once flooded the DB.
        if (!pollers.has(accountId)) pollers.set(accountId, setInterval(() => refreshBook(accountId), 10_000));
        return () => {
            set.delete(setBook);
            if (set.size === 0) {
                clearInterval(pollers.get(accountId));
                pollers.delete(accountId);
            }
        };
    }, [accountId]);
    return book;
}

export function useAccountState(accountId: string): AccountState | null {
    return useBook(accountId)?.account ?? null;
}

export function usePositions(accountId: string) {
    const book = useBook(accountId);
    return {
        positions: book?.positions ?? [],
        account: book?.account ?? null,
        error: book?.error ?? null,
        loaded: !!book && book.loadedAt > 0,
    };
}

/** Client-side mark of an open position against the latest quote. */
export function markPnL(p: Position, bid?: number, ask?: number): number | null {
    if (p.status !== 'OPEN') return p.finalProfit;
    const close = p.side === 'BUY' ? bid : ask;
    if (close == null || !p.contractSize) return p.unrealizedPnL ?? null;
    const move = p.side === 'BUY' ? close - p.entryPrice : p.entryPrice - close;
    const rate = p.quoteRate ?? 1;
    return move * p.contractSize * p.volume * rate - (p.commission || 0) + (p.swap || 0);
}
