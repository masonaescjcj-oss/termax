import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import {
    ErrorBox, Field, Loading, Modal, PnL, confirmDestructive,
    money, useLoader, useToast, when,
} from '../components/ui';

type Detail = {
    profile: any;
    deactivated: boolean;
    accounts: { cTraderId: string; accountType: string; broker: string; balance: number; currency: string }[];
    openPositions: any[];
    stats: { closedTrades: number; wins: number; winRate: number; netProfit: number };
    bots: { id: string; name: string; status: string; accountId: string; createdAt: string }[];
};

export default function UserDetail() {
    const { id } = useParams();
    const toast = useToast();
    const [editing, setEditing] = useState<{ accountId: string; balance: string } | null>(null);

    const load = useLoader(() => api<{ data: Detail }>(`/admin/users/${id}`).then(r => r.data), [id]);

    if (load.loading) return <Loading />;
    if (load.error) return <ErrorBox message={load.error} onRetry={load.reload} />;
    const d = load.data!;
    const p = d.profile;

    const act = async (fn: () => Promise<any>, done: string) => {
        try { await fn(); toast.ok(done); load.reload(); } catch (e) { toast.err(e); }
    };

    const saveBalance = async () => {
        if (!editing) return;
        const amount = Number(editing.balance);
        if (!Number.isFinite(amount) || amount < 0) return toast.err(new Error('Enter a balance of 0 or more.'));
        await act(
            () => api('/admin/users/balance', { method: 'POST', body: { userId: id, accountId: editing.accountId, balance: amount } }),
            'Balance updated.',
        );
        setEditing(null);
    };

    return (
        <>
            <div className="row between" style={{ marginBottom: 16 }}>
                <div>
                    <Link to="/users" className="muted">← All users</Link>
                    <h2 style={{ margin: '6px 0 2px' }}>
                        {p.username}
                        {d.deactivated && <span className="pill off" style={{ marginLeft: 10 }}>SUSPENDED</span>}
                    </h2>
                    <div className="muted">{p.email} · joined {when(p.createdAt)}</div>
                </div>
                <div className="row">
                    <span className={`pill ${p.role === 'admin' ? 'admin' : p.role === 'moderator' ? 'mod' : ''}`}>{p.role}</span>
                    <span className={`pill ${p.plan === 'PRO' ? 'pro' : ''}`}>{p.plan || 'FREE'}</span>
                    <button
                        className={d.deactivated ? '' : 'danger'}
                        onClick={() => {
                            const next = d.deactivated;
                            if (!next && !confirmDestructive(`Suspend ${p.username}? They will not be able to sign in.`)) return;
                            act(() => api('/admin/users/active', { method: 'POST', body: { userId: id, active: next } }),
                                next ? 'Account restored.' : 'Account suspended.');
                        }}
                    >
                        {d.deactivated ? 'Restore account' : 'Suspend account'}
                    </button>
                </div>
            </div>

            <div className="grid stats" style={{ marginBottom: 16 }}>
                <div className="card stat"><div className="label">Closed trades</div><div className="value">{d.stats.closedTrades}</div></div>
                <div className="card stat"><div className="label">Win rate</div><div className="value">{d.stats.winRate}%</div></div>
                <div className="card stat"><div className="label">Realised P/L</div><div className="value"><PnL value={d.stats.netProfit} /></div></div>
                <div className="card stat"><div className="label">Open positions</div><div className="value">{d.openPositions.length}</div></div>
                <div className="card stat"><div className="label">Referrals</div><div className="value">{p.referralCount || 0}</div></div>
            </div>

            <div className="grid two">
                <div className="card">
                    <strong style={{ display: 'block', marginBottom: 10 }}>Accounts</strong>
                    {!d.accounts.length ? <p className="muted">No trading account.</p> : (
                        <table>
                            <tbody>
                                {d.accounts.map(a => (
                                    <tr key={a.cTraderId}>
                                        <td>
                                            <div className="mono">{a.cTraderId}</div>
                                            <div className="muted" style={{ fontSize: 12 }}>{a.broker} · {a.accountType}</div>
                                        </td>
                                        <td className="num">{money(a.balance)} {a.currency}</td>
                                        <td style={{ width: 1 }}>
                                            {a.accountType === 'DEMO' ? (
                                                <button className="small" onClick={() => setEditing({ accountId: a.cTraderId, balance: String(a.balance) })}>
                                                    Set
                                                </button>
                                            ) : (
                                                <span className="muted" style={{ fontSize: 11 }}>broker-held</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="card">
                    <strong style={{ display: 'block', marginBottom: 10 }}>Bots</strong>
                    {!d.bots.length ? <p className="muted">No bots.</p> : (
                        <table>
                            <tbody>
                                {d.bots.map(b => (
                                    <tr key={b.id}>
                                        <td>{b.name}</td>
                                        <td><span className="pill">{b.status}</span></td>
                                        <td className="muted">{when(b.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
                <strong style={{ display: 'block', marginBottom: 10 }}>Open positions</strong>
                {!d.openPositions.length ? <p className="muted">Flat.</p> : (
                    <table>
                        <thead>
                            <tr>
                                <th>Symbol</th><th>Side</th><th className="num">Volume</th>
                                <th className="num">Entry</th><th>Opened</th><th style={{ width: 1 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {d.openPositions.map(pos => (
                                <tr key={pos.id || pos._id}>
                                    <td><strong>{pos.symbol}</strong></td>
                                    <td><span className={`pill ${pos.side === 'BUY' ? 'buy' : 'sell'}`}>{pos.side}</span></td>
                                    <td className="num">{pos.volume}</td>
                                    <td className="num">{pos.entryPrice}</td>
                                    <td className="muted">{when(pos.openTime)}</td>
                                    <td>
                                        {pos.venue !== 'CTRADER' && (
                                            <button
                                                className="small danger"
                                                onClick={() => {
                                                    if (!confirmDestructive(`Force-close ${pos.side} ${pos.volume} ${pos.symbol} at market?`)) return;
                                                    act(() => api(`/admin/positions/${pos.id || pos._id}/close`, { method: 'POST' }), 'Position closed.');
                                                }}
                                            >
                                                Close
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {editing && (
                <Modal
                    title="Set demo balance"
                    onClose={() => setEditing(null)}
                    footer={<>
                        <button className="ghost" onClick={() => setEditing(null)}>Cancel</button>
                        <button className="primary" onClick={saveBalance}>Save</button>
                    </>}
                >
                    <p className="muted" style={{ marginTop: 0 }}>
                        Account <span className="mono">{editing.accountId}</span>. This is demo money — a live
                        balance belongs to the broker and cannot be set here.
                    </p>
                    <Field label="Balance (USD)" type="number" value={editing.balance} onChange={v => setEditing({ ...editing, balance: v })} />
                </Modal>
            )}
        </>
    );
}
