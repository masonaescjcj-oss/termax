/**
 * The day's reference price per symbol — the open of the current daily bar —
 * so the watchlist and toolbar can show a change since the day began. One
 * request per symbol per session, shared by every view.
 */
import { useEffect, useState } from 'react';
import { fetchCandles } from './market';

const opens = new Map<string, number>();
const pending = new Map<string, Promise<number | null>>();
const listeners = new Map<string, Set<(v: number) => void>>();

export function dayOpenOf(symbol: string): Promise<number | null> {
    const have = opens.get(symbol);
    if (have != null) return Promise.resolve(have);
    const running = pending.get(symbol);
    if (running) return running;
    const p = fetchCandles(symbol, '1d', 2).then(rows => {
        const last = rows[rows.length - 1];
        if (!last) return null;
        opens.set(symbol, last.open);
        listeners.get(symbol)?.forEach(fn => fn(last.open));
        return last.open;
    }).catch(() => null).finally(() => pending.delete(symbol));
    pending.set(symbol, p);
    return p;
}

export function useDayOpen(symbol: string | null | undefined): number | null {
    const [v, setV] = useState<number | null>(symbol ? opens.get(symbol) ?? null : null);
    useEffect(() => {
        if (!symbol) { setV(null); return; }
        setV(opens.get(symbol) ?? null);
        if (!listeners.has(symbol)) listeners.set(symbol, new Set());
        listeners.get(symbol)!.add(setV);
        void dayOpenOf(symbol);
        return () => { listeners.get(symbol)?.delete(setV); };
    }, [symbol]);
    return v;
}

export function useDayOpens(symbols: string[]): Record<string, number> {
    const key = symbols.join('|');
    const [, bump] = useState(0);
    useEffect(() => {
        const offs = symbols.map(s => {
            if (!listeners.has(s)) listeners.set(s, new Set());
            const fn = () => bump(n => n + 1);
            listeners.get(s)!.add(fn);
            void dayOpenOf(s);
            return () => { listeners.get(s)?.delete(fn); };
        });
        return () => offs.forEach(off => off());
    }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
    const out: Record<string, number> = {};
    for (const s of symbols) { const v = opens.get(s); if (v != null) out[s] = v; }
    return out;
}

export const changePct = (price: number | undefined, open: number | undefined | null) =>
    price != null && open ? ((price - open) / open) * 100 : null;
