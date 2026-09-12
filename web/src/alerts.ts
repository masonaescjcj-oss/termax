/**
 * Price alerts. Kept in the browser (they are the trader's own reminders,
 * not orders), checked against the live feed, and announced with a toast
 * and — when the tab is allowed to — a system notification.
 */
import { useEffect, useState } from 'react';
import { watch } from './market';

export interface PriceAlert {
    id: string;
    symbol: string;
    price: number;
    condition: 'above' | 'below';
    note?: string;
    createdAt: number;
    triggeredAt: number | null;
}

const KEY = 'tx.alerts';
let alerts: PriceAlert[] = load();
const listeners = new Set<(a: PriceAlert[]) => void>();
const watching = new Map<string, () => void>();
let announce: ((a: PriceAlert, price: number) => void) | null = null;

function load(): PriceAlert[] {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function save() {
    try { localStorage.setItem(KEY, JSON.stringify(alerts)); } catch { /* storage unavailable */ }
    listeners.forEach(fn => fn(alerts));
    syncWatches();
}

function syncWatches() {
    const active = new Set(alerts.filter(a => !a.triggeredAt).map(a => a.symbol));
    for (const [sym, off] of watching) if (!active.has(sym)) { off(); watching.delete(sym); }
    for (const sym of active) {
        if (watching.has(sym)) continue;
        watching.set(sym, watch(sym, q => {
            let changed = false;
            for (const a of alerts) {
                if (a.symbol !== sym || a.triggeredAt) continue;
                const hit = a.condition === 'above' ? q.price >= a.price : q.price <= a.price;
                if (hit) { a.triggeredAt = Date.now(); changed = true; announce?.(a, q.price); }
            }
            if (changed) save();
        }));
    }
}

export function setAlertAnnouncer(fn: (a: PriceAlert, price: number) => void) {
    announce = fn;
    syncWatches();
}

export function addAlert(input: Omit<PriceAlert, 'id' | 'createdAt' | 'triggeredAt'>) {
    alerts = [{ ...input, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now(), triggeredAt: null }, ...alerts];
    save();
}
export function removeAlert(id: string) { alerts = alerts.filter(a => a.id !== id); save(); }
export function resetAlert(id: string) { alerts = alerts.map(a => (a.id === id ? { ...a, triggeredAt: null } : a)); save(); }
export function clearTriggered() { alerts = alerts.filter(a => !a.triggeredAt); save(); }

export function useAlerts(): PriceAlert[] {
    const [list, setList] = useState(alerts);
    useEffect(() => { listeners.add(setList); return () => { listeners.delete(setList); }; }, []);
    return list;
}

export async function notify(title: string, body: string) {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') { try { await Notification.requestPermission(); } catch { /* denied */ } }
    if (Notification.permission === 'granted') new Notification(title, { body, icon: '/favicon.png' });
}
