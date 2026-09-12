/**
 * The one place that talks to the backend.
 *
 * Every request goes through `api()` so three things hold everywhere: the
 * bearer token is attached, a 401 ends the session instead of leaving a
 * half-loaded terminal, and a failure arrives as an Error carrying the
 * server's own message rather than "Failed to fetch".
 */

export const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const TOKEN_KEY = 'termax_token';
export const REFRESH_KEY = 'termax_refresh';
export const USER_KEY = 'termax_user';

export class ApiError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
    onUnauthorized = fn;
}

type Options = {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    /** Skip the bearer token — only the sign-in calls want this. */
    anonymous?: boolean;
};

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!opts.anonymous) {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) headers.Authorization = `Bearer ${token}`;
    }

    let res: Response;
    try {
        res = await fetch(`${BASE}/api/v1${path}`, {
            method: opts.method || 'GET',
            headers,
            body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        });
    } catch {
        throw new ApiError('Could not reach the server.', 0, 'NETWORK');
    }

    let payload: any = null;
    const text = await res.text();
    if (text) {
        try { payload = JSON.parse(text); } catch { payload = { message: text.slice(0, 300) }; }
    }

    if (res.status === 401 && !opts.anonymous) {
        onUnauthorized?.();
        throw new ApiError(payload?.message || 'Your session has expired.', 401);
    }

    if (!res.ok || payload?.success === false) {
        throw new ApiError(payload?.message || payload?.error || `The server answered ${res.status}.`, res.status, payload?.code);
    }
    return payload as T;
}

/** Build a query string from whatever is actually set. */
export function q(path: string, params: Record<string, string | number | boolean | undefined | null>) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `${path}?${s}` : path;
}

/** Unwrap the `{ success, data }` envelope most endpoints use. */
export async function data<T = any>(path: string, opts: Options = {}): Promise<T> {
    const res = await api<{ data: T }>(path, opts);
    return res.data;
}
