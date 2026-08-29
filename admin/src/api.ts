/**
 * The one place that talks to the backend.
 *
 * Everything goes through `api()` so that three things are true everywhere
 * and nowhere has to remember them: the bearer token is attached, a 401 ends
 * the session rather than rendering an empty page, and a failure arrives as
 * an Error carrying the server's own message and status instead of a bare
 * "Failed to fetch".
 */

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const TOKEN_KEY = 'termax_admin_token';
export const USER_KEY = 'termax_admin_user';

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

/** Called when the server says the session is over. Set by the auth layer. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
    onUnauthorized = fn;
}

type Options = {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    /** Skip the bearer token — only the login call wants this. */
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
        // A network failure has no status and no server message; say what it
        // actually is rather than passing along "TypeError: Failed to fetch".
        throw new ApiError('Could not reach the server. Is the backend running?', 0);
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
        throw new ApiError(payload?.message || `The server answered ${res.status}.`, res.status);
    }

    return payload as T;
}

/** GET with a query string built from whatever is actually set. */
export function q(path: string, params: Record<string, string | number | undefined | null>) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const qs = search.toString();
    return qs ? `${path}?${qs}` : path;
}

/** Where an uploaded image actually lives — the API returns a bare path. */
export function assetUrl(url?: string | null): string {
    if (!url) return '';
    if (/^https?:\/\//.test(url)) return url;
    return `${BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}
