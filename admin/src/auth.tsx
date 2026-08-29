/**
 * Session handling for the console.
 *
 * The console is a separate site from the app, so it does its own login
 * against the same backend. Two rules it enforces that the app's panel did
 * not: a non-admin is refused at the door with a clear reason rather than
 * being let in to a screen of 403s, and a 401 from any later request ends
 * the session immediately instead of leaving a half-loaded page.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, TOKEN_KEY, USER_KEY } from './api';

export type AdminUser = {
    id: string;
    username: string;
    email: string;
    role: string;
    avatarUrl?: string | null;
};

type AuthValue = {
    user: AdminUser | null;
    ready: boolean;
    signIn: (identifier: string, password: string) => Promise<void>;
    signOut: () => void;
    expiredNotice: string | null;
    clearExpiredNotice: () => void;
};

const Ctx = createContext<AuthValue>(null as unknown as AuthValue);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AdminUser | null>(null);
    const [ready, setReady] = useState(false);
    const [expiredNotice, setExpiredNotice] = useState<string | null>(null);

    // Restore a session from a previous visit, then verify it is still
    // good — a token in localStorage proves nothing about the server.
    useEffect(() => {
        const raw = localStorage.getItem(USER_KEY);
        const token = localStorage.getItem(TOKEN_KEY);
        if (!raw || !token) { setReady(true); return; }

        let cancelled = false;
        (async () => {
            try {
                setUser(JSON.parse(raw));
                // Any admin-only endpoint answers the question "is this
                // token still an admin token"; stats is the cheapest.
                await api('/admin/stats');
            } catch {
                if (!cancelled) {
                    localStorage.removeItem(TOKEN_KEY);
                    localStorage.removeItem(USER_KEY);
                    setUser(null);
                }
            } finally {
                if (!cancelled) setReady(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const signOut = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
    }, []);

    useEffect(() => {
        setUnauthorizedHandler(() => {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            setUser(null);
            setExpiredNotice('Your session expired. Please sign in again.');
        });
    }, []);

    const signIn = useCallback(async (identifier: string, password: string) => {
        const res = await api<{ data: { accessToken: string; user: AdminUser } }>(
            '/auth/login',
            { method: 'POST', body: { identifier, password }, anonymous: true },
        );

        const { accessToken, user: profile } = res.data || ({} as any);
        if (!accessToken || !profile) throw new Error('The server did not return a session.');

        if (profile.role !== 'admin') {
            // Say so here rather than letting them in to a wall of 403s.
            throw new Error('That account is not an admin. Ask an admin to grant the role.');
        }

        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(USER_KEY, JSON.stringify(profile));
        setUser(profile);
        setExpiredNotice(null);
    }, []);

    const value = useMemo<AuthValue>(() => ({
        user, ready, signIn, signOut,
        expiredNotice,
        clearExpiredNotice: () => setExpiredNotice(null),
    }), [user, ready, signIn, signOut, expiredNotice]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
    return useContext(Ctx);
}
