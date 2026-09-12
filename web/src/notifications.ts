/**
 * The notification inbox: what the server told this trader, with the
 * unread count the bell shows. Live events arrive over the user room and
 * are prepended; the list is otherwise fetched on open.
 */
import { useEffect, useState } from 'react';
import { api, data } from './api';
import { onUserEvent } from './market';

export interface Notice {
    id?: string;
    kind: 'price_alert' | 'position' | 'margin' | 'bot' | 'system';
    title: string;
    body: string;
    data: Record<string, any>;
    readAt: string | null;
    createdAt: string;
}

let items: Notice[] = [];
let unread = 0;
let fetched = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
const liveListeners = new Set<(n: Notice) => void>();
let wired = false;

function wire() {
    if (wired) return;
    wired = true;
    onUserEvent((ev, payload) => {
        if (ev !== 'notification' || !payload) return;
        const n: Notice = { id: payload.id, kind: payload.kind, title: payload.title, body: payload.body ?? '', data: payload.data ?? {}, readAt: null, createdAt: payload.createdAt ?? new Date().toISOString() };
        items = [n, ...items].slice(0, 200);
        unread += 1;
        emit();
        liveListeners.forEach(fn => fn(n));
    });
}

export async function fetchNotifications() {
    const d = await data<{ items: Notice[]; unread: number }>('/notifications?limit=50');
    items = d.items; unread = d.unread; fetched = true;
    emit();
}

export async function markAllRead() {
    if (!unread) return;
    items = items.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }));
    unread = 0; emit();
    await api('/notifications/read', { method: 'POST', body: {} }).catch(() => undefined);
}

export function resetNotifications() { items = []; unread = 0; fetched = false; emit(); }

export function useNotifications() {
    const [, bump] = useState(0);
    useEffect(() => {
        wire();
        const fn = () => bump(n => n + 1);
        listeners.add(fn);
        if (!fetched) fetchNotifications().catch(() => undefined);
        return () => { listeners.delete(fn); };
    }, []);
    return { items, unread, refresh: fetchNotifications, markAllRead };
}

/** Fires for each live notification — the toast layer hooks this. */
export function onLiveNotification(fn: (n: Notice) => void) {
    wire();
    liveListeners.add(fn);
    return () => { liveListeners.delete(fn); };
}
