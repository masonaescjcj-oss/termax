/**
 * TWO-FACTOR AUTHENTICATION (TOTP)
 *
 * Supabase GoTrue owns the factors; this module is a thin, explicit client
 * for the four calls that matter, made with the *user's own* access token
 * rather than the service key — enrolling a factor is the trader's action,
 * not an administrative one.
 *
 * The REST endpoints are used directly instead of supabase-js's
 * `auth.mfa.*` because those read a session from client-side storage,
 * which a stateless server does not have.
 */

const URL_BASE = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
// The gateway wants an apikey; the Authorization header is what identifies
// the user. The anon key is the right one here — the service key would ask
// GoTrue to treat the call as administrative.
const API_KEY = () => process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY || '';

export interface Factor {
    id: string;
    friendlyName: string | null;
    factorType: string;
    status: 'verified' | 'unverified' | string;
    createdAt: string | null;
}

export class MfaError extends Error {
    status: number;
    constructor(message: string, status = 400) {
        super(message);
        this.name = 'MfaError';
        this.status = status;
    }
}

async function call<T>(path: string, token: string, init: { method?: string; body?: any } = {}): Promise<T> {
    const base = URL_BASE();
    if (!base) throw new MfaError('Authentication is not configured on this server.', 503);
    let res: Response;
    try {
        res = await fetch(`${base}/auth/v1${path}`, {
            method: init.method ?? 'GET',
            headers: { apikey: API_KEY(), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: init.body === undefined ? undefined : JSON.stringify(init.body),
        });
    } catch (e: any) {
        throw new MfaError(`Could not reach the authentication service: ${e.message}`, 503);
    }
    const text = await res.text();
    let payload: any = null;
    if (text) { try { payload = JSON.parse(text); } catch { payload = { msg: text.slice(0, 200) }; } }
    if (!res.ok) {
        const msg = payload?.msg || payload?.message || payload?.error_description || `The authentication service answered ${res.status}.`;
        throw new MfaError(msg, res.status === 401 || res.status === 403 ? 401 : 400);
    }
    return payload as T;
}

const toFactor = (f: any): Factor => ({
    id: f.id,
    friendlyName: f.friendly_name ?? null,
    factorType: f.factor_type ?? 'totp',
    status: f.status,
    createdAt: f.created_at ?? null,
});

/** Start enrolment: returns the id, the QR image and the secret to type in. */
export async function enrollTotp(token: string, friendlyName: string): Promise<{ id: string; qrCode: string | null; secret: string | null; uri: string | null }> {
    const d = await call<any>('/factors', token, {
        method: 'POST',
        body: { factor_type: 'totp', friendly_name: friendlyName, issuer: 'Termax' },
    });
    return { id: d.id, qrCode: d.totp?.qr_code ?? null, secret: d.totp?.secret ?? null, uri: d.totp?.uri ?? null };
}

export async function challenge(token: string, factorId: string): Promise<string> {
    const d = await call<any>(`/factors/${encodeURIComponent(factorId)}/challenge`, token, { method: 'POST' });
    if (!d?.id) throw new MfaError('The authentication service did not return a challenge.');
    return d.id;
}

/** Verify a code. On success GoTrue issues a fresh aal2 session. */
export async function verify(token: string, factorId: string, challengeId: string, code: string): Promise<{ accessToken: string; refreshToken: string }> {
    const d = await call<any>(`/factors/${encodeURIComponent(factorId)}/verify`, token, {
        method: 'POST',
        body: { challenge_id: challengeId, code },
    });
    if (!d?.access_token) throw new MfaError('That code was not accepted.');
    return { accessToken: d.access_token, refreshToken: d.refresh_token };
}

/** Challenge and verify in one step — what both enrolment and sign-in need. */
export async function challengeAndVerify(token: string, factorId: string, code: string) {
    return verify(token, factorId, await challenge(token, factorId), code);
}

export async function listFactors(token: string): Promise<Factor[]> {
    const d = await call<any>('/user', token);
    return ((d?.factors ?? []) as any[]).map(toFactor);
}

export async function unenroll(token: string, factorId: string): Promise<void> {
    await call(`/factors/${encodeURIComponent(factorId)}`, token, { method: 'DELETE' });
}

/* ── Token inspection ─────────────────────────────────────────────────── */

/**
 * The assurance level carried by an access token: 'aal2' once a second
 * factor has been presented in this session. Read from the payload
 * without verifying — the caller has already verified the token itself.
 */
export function aalOf(token: string): string | null {
    try {
        const part = token.split('.')[1];
        if (!part) return null;
        const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        const payload = JSON.parse(json);
        return typeof payload?.aal === 'string' ? payload.aal : null;
    } catch {
        return null;
    }
}

/**
 * Does this account have a verified second factor? Answered from the
 * admin API and cached, because it is asked on every authenticated
 * request that arrives without aal2.
 */
const factorCache = new Map<string, { at: number; has: boolean }>();
const FACTOR_TTL_MS = 60_000;

export async function hasVerifiedFactor(userId: string): Promise<boolean> {
    const hit = factorCache.get(userId);
    if (hit && Date.now() - hit.at < FACTOR_TTL_MS) return hit.has;
    let has = false;
    try {
        const { supabase } = await import('../config/supabase');
        const { data, error } = await (supabase.auth.admin as any).mfa.listFactors({ userId });
        if (!error) has = ((data?.factors ?? []) as any[]).some(f => f.status === 'verified');
    } catch {
        // If the lookup fails, do not lock the trader out of their own
        // account: 2FA is enforced when it can be proven, not guessed.
        has = hit?.has ?? false;
    }
    factorCache.set(userId, { at: Date.now(), has });
    return has;
}

/** Called after enrol/unenrol so the next request sees the change. */
export function forgetFactors(userId: string): void {
    factorCache.delete(userId);
}
