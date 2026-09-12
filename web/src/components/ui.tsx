import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/* ── Toasts ────────────────────────────────────────────────────────────── */
type Toast = { id: number; text: string; kind: 'ok' | 'err' | 'info' };
type ToastFn = (text: string, kind?: Toast['kind']) => void;
const ToastCtx = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [list, setList] = useState<Toast[]>([]);
    const push = useCallback<ToastFn>((text, kind = 'info') => {
        const id = Date.now() + Math.random();
        setList(l => [...l, { id, text, kind }]);
        setTimeout(() => setList(l => l.filter(t => t.id !== id)), kind === 'err' ? 6000 : 3500);
    }, []);
    return (
        <ToastCtx.Provider value={push}>
            {children}
            <div className="toasts">
                {list.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
            </div>
        </ToastCtx.Provider>
    );
}
export const useToast = () => useContext(ToastCtx);

/* ── Async loader ──────────────────────────────────────────────────────── */
export function useLoader<T>(fn: () => Promise<T>, deps: unknown[], opts: { every?: number } = {}) {
    const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
    const fnRef = useRef(fn);
    fnRef.current = fn;
    const [tick, setTick] = useState(0);
    useEffect(() => {
        let alive = true;
        setState(s => ({ ...s, loading: s.data === null }));
        fnRef.current().then(
            d => { if (alive) setState({ data: d, error: null, loading: false }); },
            e => { if (alive) setState(s => ({ data: s.data, error: e?.message || 'Something went wrong.', loading: false })); },
        );
        return () => { alive = false; };
    }, [...deps, tick]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!opts.every) return;
        const id = setInterval(() => setTick(t => t + 1), opts.every);
        return () => clearInterval(id);
    }, [opts.every]);
    const reload = useCallback(() => setTick(t => t + 1), []);
    return { ...state, reload, setData: (d: T) => setState(s => ({ ...s, data: d })) };
}

/* ── Modal ─────────────────────────────────────────────────────────────── */
export function Modal({ title, onClose, children, footer, wide, className }: {
    title?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean; className?: string;
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (
        <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={`modal ${wide ? 'wide' : ''} ${className || ''}`} role="dialog" aria-modal="true">
                {title !== undefined && (
                    <div className="mh"><h3>{title}</h3><button className="x" onClick={onClose} aria-label="Close">×</button></div>
                )}
                <div className="mb">{children}</div>
                {footer && <div className="mf">{footer}</div>}
            </div>
        </div>
    );
}

/* ── Inputs ────────────────────────────────────────────────────────────── */
export function Field({ label, error, hint, children }: { label?: string; error?: string | null; hint?: string; children: React.ReactNode }) {
    return (
        <div className={`field ${error ? 'error' : ''}`}>
            {label && <label>{label}</label>}
            {children}
            {error ? <div className="hint err">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
        </div>
    );
}

export function NumberInput({ value, onChange, step = 1, min, max, unit, digits, placeholder, disabled }: {
    value: string; onChange: (v: string) => void; step?: number; min?: number; max?: number; unit?: string; digits?: number; placeholder?: string; disabled?: boolean;
}) {
    const d = digits ?? (String(step).split('.')[1]?.length || 0);
    const bump = (dir: 1 | -1) => {
        const cur = parseFloat(value) || 0;
        let next = cur + dir * step;
        if (min !== undefined) next = Math.max(min, next);
        if (max !== undefined) next = Math.min(max, next);
        onChange(next.toFixed(d));
    };
    return (
        <div className="inp">
            <button type="button" onClick={() => bump(-1)} disabled={disabled} tabIndex={-1}>−</button>
            <input value={value} onChange={e => onChange(e.target.value)} inputMode="decimal" placeholder={placeholder} disabled={disabled} />
            {unit && <span className="unit">{unit}</span>}
            <button type="button" onClick={() => bump(1)} disabled={disabled} tabIndex={-1}>+</button>
        </div>
    );
}

export const Spinner = ({ dark }: { dark?: boolean }) => <span className={`spinner ${dark ? 'dark' : ''}`} />;

export function Empty({ title, text }: { title: string; text?: string }) {
    return <div className="empty"><b>{title}</b>{text}</div>;
}

/* ── Formatting ────────────────────────────────────────────────────────── */
export const money = (v: number | null | undefined, digits = 2) => {
    if (v == null || !Number.isFinite(v)) return '—';
    const sign = v < 0 ? '-' : '';
    return `${sign}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};
export const signed = (v: number | null | undefined, digits = 2) => {
    if (v == null || !Number.isFinite(v)) return '—';
    return `${v > 0 ? '+' : v < 0 ? '-' : ''}$${Math.abs(v).toFixed(digits)}`;
};
export const pct = (v: number | null | undefined, digits = 2) => (v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`);
export const when = (v: string | number | Date | null | undefined) => {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
export const ago = (v: string | number | Date | null | undefined) => {
    if (!v) return '—';
    const s = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000);
    if (s < 60) return `${Math.floor(s)}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
};
export const pnlClass = (v: number | null | undefined) => (v == null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '');

/* ── Click-outside ─────────────────────────────────────────────────────── */
export function useClickOutside<T extends HTMLElement>(open: boolean, onClose: () => void) {
    const ref = useRef<T>(null);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open, onClose]);
    return ref;
}

/* ── Persisted UI state ────────────────────────────────────────────────── */
export function useStored<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
    const [v, setV] = useState<T>(() => {
        try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : initial; } catch { return initial; }
    });
    const set = useCallback((next: T | ((p: T) => T)) => {
        setV(prev => {
            const val = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
            try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage unavailable */ }
            return val;
        });
    }, [key]);
    return useMemo(() => [v, set], [v, set]);
}
