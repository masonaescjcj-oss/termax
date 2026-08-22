/**
 * cTRADER OAUTH
 *
 * Handles the browser half of linking a broker account: build the consent URL,
 * exchange the returned code for tokens, and refresh them before they expire.
 * The protobuf transport that uses these tokens lives in
 * services/ctrader/connection.ts.
 *
 * Three problems in the previous version are fixed here:
 *
 *  - No CSRF protection. /callback took any code from anyone and there was no
 *    way to tell which user a callback belonged to. A signed, single-use
 *    `state` parameter now carries the user id and expires.
 *  - The token lived in a module-level variable: one token for the whole
 *    process, lost on restart, and wrong as soon as a second user linked an
 *    account. Tokens now belong to the account record.
 *  - `refreshToken` was accepted and never used, so a link silently died when
 *    the access token expired.
 */

import axios from 'axios';
import crypto from 'crypto';

const CLIENT_ID = process.env.CTRADER_CLIENT_ID || '';
const CLIENT_SECRET = process.env.CTRADER_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.CTRADER_REDIRECT_URI || 'http://localhost:5000/api/v1/trade/callback';

const TOKEN_URL = 'https://openapi.ctrader.com/apps/token';
const AUTH_URL = 'https://connect.spotware.com/apps/auth';

/**
 * `trading` alone cannot enumerate the accounts behind a token, which is
 * needed to resolve a ctidTraderAccountId, so `accounts` is requested too.
 */
const SCOPE = 'accounts trading';

/** A state token is only useful for the length of a consent redirect. */
const STATE_TTL_MS = 10 * 60 * 1000;

export interface CTraderTokens {
    accessToken: string;
    refreshToken?: string;
    /** Seconds until the access token expires, as the server reports it. */
    expiresIn?: number;
    /** Absolute expiry, derived on receipt so it survives storage. */
    expiresAt?: number;
}

// ═══════════════════════════════════════════════════════════════
//  CSRF STATE
// ═══════════════════════════════════════════════════════════════

/**
 * States are signed with the app secret and additionally held in memory so
 * each can only be redeemed once. The signature means a restart cannot be
 * exploited to forge one; the set means a captured URL cannot be replayed.
 */
const issuedStates = new Map<string, number>();

function signState(payload: string): string {
    return crypto
        .createHmac('sha256', CLIENT_SECRET || 'ctrader-state')
        .update(payload)
        .digest('base64url');
}

/** Mint a single-use state parameter bound to a user. */
export function createState(userId: string): string {
    const nonce = crypto.randomBytes(16).toString('base64url');
    const payload = `${userId}.${Date.now()}.${nonce}`;
    const state = `${Buffer.from(payload).toString('base64url')}.${signState(payload)}`;

    issuedStates.set(state, Date.now() + STATE_TTL_MS);
    pruneStates();
    return state;
}

function pruneStates() {
    const now = Date.now();
    for (const [state, expiry] of issuedStates) {
        if (expiry < now) issuedStates.delete(state);
    }
}

/**
 * Verify and consume a state parameter, returning the user it was issued to.
 * Returns null for anything forged, expired or already used.
 */
export function consumeState(state: string | undefined): { userId: string } | null {
    if (!state) return null;

    const expiry = issuedStates.get(state);
    if (!expiry) return null;          // never issued, or already redeemed
    issuedStates.delete(state);        // single use
    if (expiry < Date.now()) return null;

    const [encoded, signature] = state.split('.');
    if (!encoded || !signature) return null;

    let payload: string;
    try {
        payload = Buffer.from(encoded, 'base64url').toString();
    } catch {
        return null;
    }

    const expected = signState(payload);
    // Constant-time compare so a mismatch cannot be probed byte by byte.
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const [userId, issuedAt] = payload.split('.');
    if (!userId || !issuedAt) return null;
    if (Date.now() - Number(issuedAt) > STATE_TTL_MS) return null;

    return { userId };
}

// ═══════════════════════════════════════════════════════════════
//  AUTHORISATION
// ═══════════════════════════════════════════════════════════════

export function isConfigured(): boolean {
    return Boolean(CLIENT_ID && CLIENT_SECRET);
}

/**
 * Consent URL for a specific user. The state parameter is what ties the
 * eventual callback back to them.
 */
export function getAuthUrl(userId: string): string {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: SCOPE,
        state: createState(userId),
    });
    return `${AUTH_URL}?${params.toString()}`;
}

function normaliseTokens(data: any): CTraderTokens {
    const accessToken = data?.accessToken ?? data?.access_token;
    if (!accessToken) throw new Error('cTrader returned no access token');

    const expiresIn = Number(data?.expiresIn ?? data?.expires_in) || undefined;
    return {
        accessToken,
        refreshToken: data?.refreshToken ?? data?.refresh_token,
        expiresIn,
        // Store an absolute expiry so a token read back from the database can
        // still be judged fresh or stale.
        expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
    };
}

/** Exchange an authorisation code for tokens. */
export async function getAccessToken(authCode: string): Promise<CTraderTokens> {
    try {
        const response = await axios.post(TOKEN_URL, null, {
            params: {
                grant_type: 'authorization_code',
                code: authCode,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
            },
            timeout: 15_000,
        });
        return normaliseTokens(response.data);
    } catch (error: any) {
        const detail = error.response?.data ?? error.message;
        console.error('[cTrader OAuth] Token exchange failed:', detail);
        throw new Error('Could not exchange the authorisation code with cTrader.');
    }
}

/** Trade a refresh token for a fresh access token. */
export async function refreshAccessToken(refreshToken: string): Promise<CTraderTokens> {
    try {
        const response = await axios.post(TOKEN_URL, null, {
            params: {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
            },
            timeout: 15_000,
        });
        return normaliseTokens(response.data);
    } catch (error: any) {
        const detail = error.response?.data ?? error.message;
        console.error('[cTrader OAuth] Token refresh failed:', detail);
        throw new Error('Could not refresh the cTrader access token. The account must be linked again.');
    }
}

/** True when a token is expired or close enough that it should be refreshed. */
export function needsRefresh(tokens: Pick<CTraderTokens, 'expiresAt'>, marginMs = 5 * 60 * 1000): boolean {
    if (!tokens.expiresAt) return false;   // no expiry known; use until refused
    return Date.now() > tokens.expiresAt - marginMs;
}

/**
 * Return a usable access token for an account record, refreshing in place when
 * it is due. Mutates the record so the caller can persist it.
 */
export async function ensureFreshToken(account: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
}): Promise<{ accessToken: string; refreshed: boolean }> {
    if (!account.accessToken) throw new Error('This account has no cTrader access token.');

    if (!needsRefresh(account) || !account.refreshToken) {
        return { accessToken: account.accessToken, refreshed: false };
    }

    const fresh = await refreshAccessToken(account.refreshToken);
    account.accessToken = fresh.accessToken;
    if (fresh.refreshToken) account.refreshToken = fresh.refreshToken;
    account.expiresAt = fresh.expiresAt;
    return { accessToken: fresh.accessToken, refreshed: true };
}

// ═══════════════════════════════════════════════════════════════
//  Deprecated single-token store
// ═══════════════════════════════════════════════════════════════

/**
 * Kept only so older imports keep compiling. A process-wide token is wrong as
 * soon as two users link an account, so tokens belong on the account record and
 * are read through ensureFreshToken().
 */
let legacyToken: string | null = null;

/** @deprecated store the token on the account record instead. */
export const setToken = (token: string) => { legacyToken = token; };

/** @deprecated read the token from the account record instead. */
export const getToken = () => legacyToken;
