import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, q } from '../api';
import { ErrorBox, Loading, useLoader, useToast, when } from '../components/ui';

type Row = {
    id: string; username: string; email: string; role: string; plan: string;
    deactivated: boolean; accounts: number; balance: number;
    referralCount: number; lastLogin: string | null; createdAt: string;
};

const ROLE_CLASS: Record<string, string> = { admin: 'admin', moderator: 'mod' };

export default function Users() {
    const toast = useToast();
    const [search, setSearch] = useState('');
    const [applied, setApplied] = useState('');
    const [role, setRole] = useState('');
    const [plan, setPlan] = useState('');
    const [page, setPage] = useState(1);
    const perPage = 25;

    const list = useLoader(
        () => api<{ data: Row[]; total: number }>(q('/admin/users/search', { q: applied, role, plan, page, perPage })),
        [applied, role, plan, page],
    );

    const act = async (fn: () => Promise<any>, done: string) => {
        try {
            await fn();
            toast.ok(done);
            list.reload();
        } catch (e) {
            toast.err(e);
        }
    };

    const setPlanFor = (u: Row) =>
        act(() => api('/admin/users/plan', { method: 'POST', body: { userId: u.id, plan: u.plan === 'PRO' ? 'FREE' : 'PRO' } }),
            `${u.username} is now on ${u.plan === 'PRO' ? 'FREE' : 'PRO'}.`);

    const setRoleFor = (u: Row, next: string) =>
        act(() => api('/admin/users/role', { method: 'POST', body: { userId: u.id, role: next } }),
            `${u.username} is now ${next}.`);

    const total = list.data?.total ?? 0;
    const pages = Math.max(1, Math.ceil(total / perPage));

    return (
        <>
            <form
                className="row"
                style={{ marginBottom: 16 }}
                onSubmit={e => { e.preventDefault(); setPage(1); setApplied(search.trim()); }}
            >
                <input
                    style={{ maxWidth: 280 }}
                    placeholder="Search username or email"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <select style={{ width: 'auto' }} value={role} onChange={e => { setPage(1); setRole(e.target.value); }}>
                    <option value="">Any role</option>
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                </select>
                <select style={{ width: 'auto' }} value={plan} onChange={e => { setPage(1); setPlan(e.target.value); }}>
                    <option value="">Any plan</option>
                    <option value="FREE">Free</option>
                    <option value="PRO">Pro</option>
                </select>
                <button className="primary">Search</button>
                {(applied || role || plan) && (
                    <button type="button" className="ghost" onClick={() => { setSearch(''); setApplied(''); setRole(''); setPlan(''); setPage(1); }}>
                        Clear
                    </button>
                )}
                <div className="spacer" />
                <span className="muted">{total} user{total === 1 ? '' : 's'}</span>
            </form>

            {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
            {list.loading ? <Loading /> : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>Plan</th>
                                <th className="num">Balance</th>
                                <th className="num">Refs</th>
                                <th>Last login</th>
                                <th style={{ width: 1 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {!list.data?.data.length && (
                                <tr><td colSpan={7} className="empty">No user matches that.</td></tr>
                            )}
                            {list.data?.data.map(u => (
                                <tr key={u.id}>
                                    <td>
                                        <Link to={`/users/${u.id}`}><strong>{u.username}</strong></Link>
                                        {u.deactivated && <span className="pill off" style={{ marginLeft: 8 }}>SUSPENDED</span>}
                                        <div className="muted" style={{ fontSize: 12 }}>{u.email}</div>
                                    </td>
                                    <td>
                                        <select
                                            style={{ width: 'auto' }}
                                            className={`pill ${ROLE_CLASS[u.role] || ''}`}
                                            value={u.role}
                                            onChange={e => setRoleFor(u, e.target.value)}
                                        >
                                            <option value="user">user</option>
                                            <option value="moderator">moderator</option>
                                            <option value="admin">admin</option>
                                        </select>
                                    </td>
                                    <td>
                                        <button
                                            className={`small ${u.plan === 'PRO' ? '' : 'ghost'}`}
                                            style={u.plan === 'PRO' ? { background: 'rgba(245,158,11,0.16)', color: 'var(--warning)', borderColor: 'transparent' } : undefined}
                                            onClick={() => setPlanFor(u)}
                                            title="Click to switch plan"
                                        >
                                            {u.plan}
                                        </button>
                                    </td>
                                    <td className="num">${u.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                                    <td className="num">{u.referralCount}</td>
                                    <td className="muted">{when(u.lastLogin)}</td>
                                    <td><Link className="btn small" to={`/users/${u.id}`}>Open</Link></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {pages > 1 && (
                <div className="row" style={{ marginTop: 14, justifyContent: 'center' }}>
                    <button className="small" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                    <span className="muted">Page {page} of {pages}</span>
                    <button className="small" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
            )}
        </>
    );
}
