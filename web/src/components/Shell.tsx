/**
 * The frame every signed-in page shares: the top bar with brand, section
 * navigation, feed status, the trading account pill and the user menu.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { accountIdOf, primaryAccount, useAuth } from '../auth';
import { connectFeed, syncUserRoom, useFeedStatus } from '../market';
import { Bell } from './Bell';
import { money, useClickOutside } from './ui';
import { Ic } from './icons';
import { useAccountState } from '../terminal/account';

const NAV: Array<{ to: string; label: string }> = [
    { to: '/', label: 'Chart' },
    { to: '/markets', label: 'Markets' },
    { to: '/screener', label: 'Screener' },
    { to: '/bots', label: 'Bots' },
    { to: '/backtests', label: 'Backtests' },
    { to: '/journal', label: 'Journal' },
    { to: '/portfolio', label: 'Portfolio' },
    { to: '/library', label: 'Library' },
    { to: '/ai', label: 'MaxAI' },
];

export function Shell({ children }: { children: React.ReactNode }) {
    const { user, signOut, offline } = useAuth();
    const up = useFeedStatus();
    const acc = primaryAccount(user);
    const state = useAccountState(accountIdOf(acc));
    const [open, setOpen] = useState(false);
    const close = useCallback(() => setOpen(false), []);
    const ref = useClickOutside<HTMLDivElement>(open, close);
    const nav = useNavigate();
    const loc = useLocation();
    useEffect(() => { connectFeed(); syncUserRoom(); }, [user?.id]);
    const openSearch = () => {
        if (loc.pathname === '/' || loc.pathname.startsWith('/chart/')) window.dispatchEvent(new Event('tx:search'));
        else nav('/', { state: { search: true } });
    };

    const initials = (user?.username || '?').slice(0, 2).toUpperCase();

    return (
        <div className="shell">
            <header className="topbar">
                <NavLink to="/" className="brand" aria-label="Termax home">
                    <img src="/logo.png" alt="" />
                    <span>Termax</span>
                </NavLink>
                <nav className="nav">
                    {NAV.map(n => (
                        <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>{n.label}</NavLink>
                    ))}
                </nav>
                <button className="hsearch" onClick={openSearch} title="Search symbol (Ctrl+K)"><Ic.search /><span>Search symbol</span><kbd>Ctrl K</kbd></button>
                <div className="spacer" />
                <div className={`feed ${up ? 'up' : ''}`} title={up ? 'Live market feed connected' : 'Reconnecting to the market feed'}>
                    <i />{up ? 'Live' : offline ? 'Offline' : 'Connecting'}
                </div>
                <div className="acct-pill" title="Trading account">
                    <span className="tag">{acc?.accountType || 'DEMO'}</span>
                    <span>Balance <b className="num">{money(state?.balance ?? acc?.balance ?? 0)}</b></span>
                    <span className="eq">Equity <b className="num">{money(state?.equity ?? acc?.balance ?? 0)}</b></span>
                </div>
                <Bell />
                <div className="menu" ref={ref}>
                    <button className="avatar" onClick={() => setOpen(o => !o)} aria-label="Account menu">
                        {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}
                    </button>
                    {open && (
                        <div className="menu-pop">
                            <div className="who"><b>{user?.username}</b><span className="muted small">{user?.email}</span></div>
                            <button onClick={() => { close(); nav('/settings'); }}>Settings</button>
                            <button onClick={() => { close(); nav('/portfolio'); }}>Portfolio &amp; risk</button>
                            <button onClick={() => { close(); nav('/journal'); }}>Trading journal</button>
                            <button className="danger" onClick={() => { close(); signOut(); }}>Sign out</button>
                        </div>
                    )}
                </div>
            </header>
            {children}
        </div>
    );
}
