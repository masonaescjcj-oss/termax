/** A prefilled order the chart hands to the ticket (from the position tool). */
import { useEffect, useState } from 'react';

export interface TicketDraft { side: 'BUY' | 'SELL'; kind: 'MARKET' | 'LIMIT' | 'STOP'; entry?: number; stopLoss?: number | null; takeProfit?: number | null; volume?: number; at: number }

let current: TicketDraft | null = null;
const listeners = new Set<(d: TicketDraft | null) => void>();

export function setTicketDraft(d: Omit<TicketDraft, 'at'> | null) {
    current = d ? { ...d, at: Date.now() } : null;
    listeners.forEach(fn => fn(current));
}
export function useTicketDraft(): TicketDraft | null {
    const [d, setD] = useState(current);
    useEffect(() => { listeners.add(setD); return () => { listeners.delete(setD); }; }, []);
    return d;
}
