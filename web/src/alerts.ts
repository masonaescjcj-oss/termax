/**
 * Price alerts, kept on the server so they fire whether or not this tab is
 * open — the terminal, the app and Telegram all hear about the same alert.
 * This module is the client cache plus the calls that change it.
 */
import { useEffect, useState } from 'react';
import { api, data } from './api';
import { onUserEvent } from './market';

export interface PriceAlert {
    id: string;
    symbol: string;
    price: number;
    condition: 'above' | 'below';
    note: string | null;
    status: 'active' | 'triggered' | 'cancelled';
    triggeredAt: string | null;
    triggeredPrice: number | null;
    createdAt: string;
}

let cache: PriceAlert[] | null = null;
let loading: Promise<PriceAlert[]> | null = null;
const listeners = new Set<(a: PriceAlert[]) => void>();
const emit = () => listeners.forEach(fn => fn(cache ?? []));

export async function loadAlerts(force = false): Promise<PriceAlert[]> {
    if (cache && !force) return cache;
    if (loading) return loading;
    loading = data<PriceAlert[]>('/alerts').then(rows => { cache = rows; emit(); return rows; }).finally(() => { loading = null; });
    return loading;
}

export async function addAlert(input: { symbol: string; price: number; condition: 'above' | 'below'; note?: string }) {
    const row = await data<PriceAlert>('/alerts', { method: 'POST', body: input });
    cache = [row, ...(cache ?? [])];
    emit();
    return row;
}
export async function removeAlert(id: string) {
    await api(`/alerts/${id}`, { method: 'DELETE' });
    cache = (cache ?? []).filter(a => a.id !== id);
    emit();
}
export async function rearmAlert(id: string) {
    const row = await data<PriceAlert>(`/alerts/${id}/rearm`, { method: 'POST' });
    cache = (cache ?? []).map(a => (a.id === id ? row : a));
    emit();
}
export async function clearTriggered() {
    await api('/alerts/triggered', { method: 'DELETE' });
    cache = (cache ?? []).filter(a => a.status !== 'triggered');
    emit();
}

/** Forget the cache on sign-out so the next account does not see the last one's alerts. */
export function resetAlertCache() { cache = null; emit(); }

export function useAlerts(): { alerts: PriceAlert[]; loaded: boolean } {
    const [list, setList] = useState<PriceAlert[]>(cache ?? []);
    const [loaded, setLoaded] = useState(cache !== null);
    useEffect(() => {
        listeners.add(setList);
        loadAlerts().then(() => setLoaded(true)).catch(() => setLoaded(true));
        // A fired alert changes its row on the server; refresh when told.
        const off = onUserEvent((ev, payload) => { if (ev === 'notification' && payload?.kind === 'price_alert') void loadAlerts(true); });
        return () => { listeners.delete(setList); off(); };
    }, []);
    return { alerts: list, loaded };
}

export async function notify(title: string, body: string) {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') { try { await Notification.requestPermission(); } catch { /* denied */ } }
    if (Notification.permission === 'granted') new Notification(title, { body, icon: '/favicon.png' });
}
