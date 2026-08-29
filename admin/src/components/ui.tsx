/**
 * The small pieces every page needs.
 *
 * Kept in one file on purpose: they are a few dozen lines each and splitting
 * them across a components tree would cost more to navigate than it saves.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ApiError, api as apiCall, assetUrl } from '../api';

/* ── toasts ──────────────────────────────────────────────────────── */

type Toast = { id: number; kind: 'ok' | 'err'; text: string };
type ToastValue = {
    ok: (text: string) => void;
    err: (e: unknown, fallback?: string) => void;
};
const ToastCtx = createContext<ToastValue>(null as unknown as ToastValue);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const push = useCallback((kind: 'ok' | 'err', text: string) => {
        const id = Date.now() + Math.random();
        setToasts(t => [...t, { id, kind, text }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), kind === 'err' ? 7000 : 3500);
    }, []);

    const value: ToastValue = {
        ok: text => push('ok', text),
        // Errors arrive as ApiError, Error or something unrecognisable; the
        // caller should never have to unwrap them at the call site.
        err: (e, fallback = 'Something went wrong.') => {
            const text = e instanceof ApiError || e instanceof Error ? e.message : fallback;
            push('err', text || fallback);
        },
    };

    return (
        <ToastCtx.Provider value={value}>
            {children}
            <div className="toasts">
                {toasts.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
            </div>
        </ToastCtx.Provider>
    );
}

export function useToast() {
    return useContext(ToastCtx);
}

/* ── async page state ────────────────────────────────────────────── */

/**
 * Load something, and keep the three states a page actually has: loading,
 * failed (with the reason and a way to try again), and loaded. Every list
 * page uses this so none of them can quietly render an empty table when
 * the request in fact failed.
 */
export function useLoader<T>(load: () => Promise<T>, deps: unknown[] = []) {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [nonce, setNonce] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        load()
            .then(d => { if (!cancelled) { setData(d); setError(null); } })
            .catch(e => {
                if (cancelled) return;
                // A 401 has already ended the session; showing an error box
                // over a login redirect would just be noise.
                if (e instanceof ApiError && e.status === 401) return;
                setError(e?.message || 'Could not load this page.');
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, nonce]);

    return { data, error, loading, reload: () => setNonce(n => n + 1), setData };
}

export function Loading() {
    return <div className="empty">Loading…</div>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
        <div className="notice error">
            <div className="row between">
                <span>{message}</span>
                {onRetry && <button className="small" onClick={onRetry}>Retry</button>}
            </div>
        </div>
    );
}

export function Empty({ children }: { children: React.ReactNode }) {
    return <div className="empty">{children}</div>;
}

/* ── modal ───────────────────────────────────────────────────────── */

export function Modal({
    title, onClose, children, footer, wide,
}: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
    wide?: boolean;
}) {
    // Escape closes it. Without this the only way out of a tall form on a
    // laptop is to scroll back up to find Cancel.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={wide ? { maxWidth: 760 } : undefined}>
                <h2>{title}</h2>
                {children}
                {footer && <div className="modal-actions">{footer}</div>}
            </div>
        </div>
    );
}

/* ── form fields ─────────────────────────────────────────────────── */

export function Field({
    label, value, onChange, placeholder, type = 'text', hint,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    hint?: string;
}) {
    return (
        <label className="field">
            <span>{label}{hint && <em className="muted" style={{ fontStyle: 'normal' }}> — {hint}</em>}</span>
            <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
        </label>
    );
}

export function TextArea({
    label, value, onChange, placeholder,
}: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <label className="field">
            <span>{label}</span>
            <textarea value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
        </label>
    );
}

export function Toggle({
    label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="check">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
            <span>{label}</span>
        </label>
    );
}

export function Select({
    label, value, onChange, options,
}: {
    label: string; value: string; onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <label className="field">
            <span>{label}</span>
            <select value={value} onChange={e => onChange(e.target.value)}>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </label>
    );
}

/* ── confirmation ────────────────────────────────────────────────── */

/**
 * Ask before anything destructive. `window.confirm` is deliberate: the
 * console is an internal tool, and a native dialog cannot be missed or
 * mis-clicked through a stale render.
 */
export function confirmDestructive(question: string): boolean {
    return window.confirm(question);
}

/* ── formatting ──────────────────────────────────────────────────── */

export const money = (n: number | null | undefined, dp = 2) =>
    n === null || n === undefined || !Number.isFinite(Number(n))
        ? '—'
        : `${Number(n) < 0 ? '−' : ''}$${Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

export const num = (n: number | null | undefined, dp = 2) =>
    n === null || n === undefined || !Number.isFinite(Number(n))
        ? '—'
        : Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });

export function when(value?: string | number | Date | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

/** "3 minutes ago" — for logs, where the gap matters more than the clock. */
export function ago(value?: string | null): string {
    if (!value) return '—';
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return '—';
    const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (secs < 60) return 'just now';
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
}

export function PnL({ value }: { value: number | null | undefined }) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return <span className="muted">—</span>;
    return <span className={Number(value) >= 0 ? 'pos' : 'neg'}>{money(value)}</span>;
}

/* ── image upload ────────────────────────────────────────────────── */


/**
 * A URL field with a file picker beside it.
 *
 * The backend takes a data URI and hands back a path, so the file is read
 * in the browser and posted as base64. Both halves stay editable: pasting a
 * URL from elsewhere is often what an admin actually wants.
 */
export function ImageField({
    label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
    const toast = useToast();
    const [busy, setBusy] = useState(false);

    const pick = async (file: File | null) => {
        if (!file) return;
        // 4MB of image is already generous for a logo, and the whole file
        // travels as base64 in a JSON body — a third larger than the file.
        if (file.size > 4 * 1024 * 1024) {
            toast.err(new Error('That image is over 4MB. Please use a smaller one.'));
            return;
        }
        setBusy(true);
        try {
            const dataUri: string = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(new Error('Could not read that file.'));
                reader.readAsDataURL(file);
            });
            const res = await apiCall<{ url: string }>('/admin/upload', {
                method: 'POST',
                body: { imageBase64: dataUri },
            });
            onChange(res.url);
            toast.ok('Image uploaded.');
        } catch (e) {
            toast.err(e);
        } finally {
            setBusy(false);
        }
    };

    return (
        <label className="field">
            <span>{label}</span>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
                {value && (
                    <img
                        src={assetUrl(value)}
                        alt=""
                        style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }}
                    />
                )}
                <input value={value} placeholder="/uploads/… or https://…" onChange={e => onChange(e.target.value)} />
                <label className="btn small" style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}>
                    {busy ? 'Uploading…' : 'Upload'}
                    <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => { pick(e.target.files?.[0] || null); e.target.value = ''; }}
                    />
                </label>
            </div>
        </label>
    );
}
