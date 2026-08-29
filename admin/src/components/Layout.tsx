import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

const NAV = [
    { section: 'Overview', items: [
        { to: '/', label: 'Dashboard', end: true },
        { to: '/audit', label: 'Audit log' },
    ] },
    { section: 'People', items: [
        { to: '/users', label: 'Users' },
        { to: '/communities', label: 'Communities' },
    ] },
    { section: 'Trading', items: [
        { to: '/positions', label: 'Positions' },
    ] },
    { section: 'Content', items: [
        { to: '/brokers', label: 'Brokers' },
        { to: '/symbols', label: 'Promoted symbols' },
        { to: '/reviews', label: 'Reviews', badge: 'pendingReviews' },
        { to: '/campaigns', label: 'Campaigns' },
        { to: '/lotties', label: 'Reward animations' },
    ] },
    { section: 'System', items: [
        { to: '/ai', label: 'AI provider' },
    ] },
];

const TITLES: Record<string, string> = {
    '/': 'Dashboard',
    '/users': 'Users',
    '/positions': 'Open positions',
    '/brokers': 'Brokers',
    '/communities': 'Communities',
    '/symbols': 'Promoted symbols',
    '/reviews': 'Broker reviews',
    '/campaigns': 'Campaigns',
    '/lotties': 'Reward animations',
    '/ai': 'AI provider',
    '/audit': 'Audit log',
};

export default function Layout({ children }: { children: React.ReactNode }) {
    const { user, signOut } = useAuth();
    const { pathname } = useLocation();
    const [pending, setPending] = useState(0);

    // The one number worth carrying in the chrome: work waiting for someone.
    useEffect(() => {
        let cancelled = false;
        api('/admin/stats')
            .then(r => { if (!cancelled) setPending(r?.data?.pendingReviews || 0); })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, [pathname]);

    const title = TITLES[pathname] || (pathname.startsWith('/users/') ? 'User' : 'Termax Admin');

    return (
        <div className="shell">
            <aside className="sidebar">
                <div className="brand">
                    <span className="dot" />
                    <span>Termax<small>ADMIN CONSOLE</small></span>
                </div>

                {NAV.map(group => (
                    <div key={group.section}>
                        <div className="nav-section">{group.section}</div>
                        {group.items.map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={(item as any).end}
                                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                            >
                                <span>{item.label}</span>
                                {(item as any).badge === 'pendingReviews' && pending > 0 && (
                                    <span className="count">{pending}</span>
                                )}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </aside>

            <div className="main">
                <header className="topbar">
                    <h1>{title}</h1>
                    <div className="who">
                        <span>{user?.username} · admin</span>
                        <button className="small ghost" onClick={signOut}>Sign out</button>
                    </div>
                </header>
                <main className="content">{children}</main>
            </div>
        </div>
    );
}
