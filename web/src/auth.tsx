/**
 * Session handling for the terminal.
 *
 * Same rules as the app's sign-in gate: a stored token proves nothing until
 * `/auth/me` accepts it; a 401 anywhere ends the session; only a real
 * network failure is forgiven (the trader keeps the cached profile and the
 * terminal works read-only until the server is back).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, REFRESH_KEY, setUnauthorizedHandler, TOKEN_KEY, USER_KEY } from './api';

export type Account = {
    id: string;
    cTraderId?: string;
    accountId?: string;
    accountType: 'DEMO' | 'LIVE' | string;
    broker?: string;
    balance: number;
    currency: string;
    leverage?: string;
};

export type User = {
    id: string;
    username: string;
    email: string;
    role: string;
    plan?: string;
    avatarUrl?: string | null;
    watchlist?: string[];
    settings?: Record<string, any>;
    cTraderAccounts?: Account[];
    referralCode?: string;
    riskGuard?: Record<string, any>;
};

export type AuthConfig = { requireEmailVerification: boolean };

type SignInResult = { ok: true } | { ok: false; needsVerification: true; email: string };
type SignUpResult = { ok: true } | { ok: true; needsVerification: true; email: string; emailSent: boolean };

type AuthValue = {
    user: User | null;
    ready: boolean;
    offline: boolean;
    config: AuthConfig;
    signIn: (identifier: string, password: string) => Promise<SignInResult>;
    signUp: (username: string, email: string, password: string) => Promise<SignUpResult>;
    signOut: () => void;
    refresh: () => Promise<void>;
    updateMe: (patch: Partial<Pick<User, 'watchlist' | 'settings' | 'avatarUrl'>>) => Promise<void>;
    expiredNotice: string | null;
    clearExpiredNotice: () => void;
};

const Ctx = createContext<AuthValue>(null as unknown as AuthValue);

function storeSession(data: any) {
    if (data?.accessToken) localStorage.setItem(TOKEN_KEY, data.accessToken);
    if (data?.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
    if (data?.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
}

const isNetworkError = (e: unknown) => e instanceof ApiError && e.status === 0;

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [ready, setReady] = useState(false);
    const [offline, setOffline] = useState(false);
    const [config, setConfig] = useState<AuthConfig>({ requireEmailVerification: false });
    const [expiredNotice, setExpiredNotice] = useState<string | null>(null);

    useEffect(() => {
        api<{ data: AuthConfig }>('/auth/config', { anonymous: true })
            .then(r => { if (r?.data) setConfig({ requireEmailVerification: !!r.data.requireEmailVerification }); })
            .catch(() => { /* default: verification off */ });
    }, []);

    // Restore, then verify against the server.
    useEffect(() => {
        const raw = localStorage.getItem(USER_KEY);
        const token = localStorage.getItem(TOKEN_KEY);
        if (!raw || !token) { setReady(true); return; }

        let cancelled = false;
        (async () => {
            try {
                setUser(JSON.parse(raw));
                const me = await api<{ data: User }>('/auth/me');
                if (!cancelled && me?.data) {
                    setUser(me.data);
                    localStorage.setItem(USER_KEY, JSON.stringify(me.data));
                    setOffline(false);
                }
            } catch (e) {
                if (cancelled) return;
                if (isNetworkError(e)) {
                    setOffline(true);
                } else {
                    clearSession();
                    setUser(null);
                }
            } finally {
                if (!cancelled) setReady(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const signOut = useCallback(() => {
        clearSession();
        setUser(null);
    }, []);

    useEffect(() => {
        setUnauthorizedHandler(() => {
            clearSession();
            setUser(null);
            setExpiredNotice('Your session has ended. Please sign in again.');
        });
    }, []);

    const signIn = useCallback(async (identifier: string, password: string): Promise<SignInResult> => {
        const body: Record<string, string> = identifier.includes('@') ? { email: identifier, password } : { username: identifier, password };
        try {
            const res = await api<{ data: any }>('/auth/login', { method: 'POST', body, anonymous: true });
            storeSession(res.data);
            setUser(res.data.user);
            setOffline(false);
            return { ok: true };
        } catch (e) {
            if (e instanceof ApiError && e.status === 403 && e.code === 'EMAIL_NOT_VERIFIED') {
                return { ok: false, needsVerification: true, email: identifier };
            }
            throw e;
        }
    }, []);

    const signUp = useCallback(async (username: string, email: string, password: string): Promise<SignUpResult> => {
        const res = await api<{ data: any; needsVerification?: boolean; emailSent?: boolean }>(
            '/auth/register', { method: 'POST', body: { username, email, password }, anonymous: true });
        if (res.needsVerification) return { ok: true, needsVerification: true, email, emailSent: !!res.emailSent };
        storeSession(res.data);
        setUser(res.data.user);
        return { ok: true };
    }, []);

    const refresh = useCallback(async () => {
        const me = await api<{ data: User }>('/auth/me');
        if (me?.data) {
            setUser(me.data);
            localStorage.setItem(USER_KEY, JSON.stringify(me.data));
        }
    }, []);

    const updateMe = useCallback(async (patch: Partial<Pick<User, 'watchlist' | 'settings' | 'avatarUrl'>>) => {
        // Optimistic: the watchlist should feel instant.
        setUser(u => (u ? { ...u, ...patch } : u));
        const res = await api<{ data: User }>('/auth/me', { method: 'PUT', body: patch });
        if (res?.data) {
            setUser(res.data);
            localStorage.setItem(USER_KEY, JSON.stringify(res.data));
        }
    }, []);

    const value = useMemo<AuthValue>(() => ({
        user, ready, offline, config, signIn, signUp, signOut, refresh, updateMe,
        expiredNotice, clearExpiredNotice: () => setExpiredNotice(null),
    }), [user, ready, offline, config, signIn, signUp, signOut, refresh, updateMe, expiredNotice]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

/** The account the terminal trades on: DEMO by default. */
export function primaryAccount(user: User | null): Account | null {
    const list = user?.cTraderAccounts ?? [];
    if (!list.length) return null;
    return list.find(a => a.accountType === 'DEMO') ?? list[0];
}

export function accountIdOf(acc: Account | null): string {
    return acc?.cTraderId || acc?.accountId || acc?.id || 'default_demo';
}
