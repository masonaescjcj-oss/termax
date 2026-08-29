import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, q } from '../api';
import {
    ErrorBox, Loading, PnL, confirmDestructive, money, num, useLoader, useToast, when,
} from '../components/ui';

type Row = {
    id: string; _id?: string; userId: string; username: string | null;
    symbol: string; side: 'BUY' | 'SELL'; volume: number;
    entryPrice: number; stopLoss: number | null; takeProfit: number | null;
    openTime: string; venue: string; status: string; unrealized: number | null;
};

export default function Positions() {
    const toast = useToast();
    const [status, setStatus] = useState('OPEN');
    const [symbol, setSymbol] = useState('');

    const list = useLoader(
        () => api<{ data: Row[] }>(q('/admin/positions', { status, symbol })).then(r => r.data),
        [status, symbol],
    );

    const close = async (p: Row) => {
        if (!confirmDestructive(`Force-close ${p.side} ${p.volume} ${p.symbol}${p.username ? ` for ${p.username}` : ''} at market?`)) return;
        try {
            await api(`/admin/positions/${p.id || p._id}/close`, { method: 'POST' });
            toast.ok('Position closed at market.');
            list.reload();
        } catch (e) {
            toast.err(e);
        }
    };

    const rows = list.data || [];
    const exposure = rows.reduce((s, r) => s + Number(r.volume || 0), 0);
    const floating = rows.reduce((s, r) => s + Number(r.unrealized || 0), 0);

    return (
        <>
            <div className="row" style={{ marginBottom: 16 }}>
                <select style={{ width: 'auto' }} value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="OPEN">Open</option>
                    <option value="PENDING">Pending</option>
                    <option value="CLOSED">Closed</option>
                </select>
                <input
                    style={{ maxWidth: 200 }}
                    placeholder="Filter by symbol"
                    value={symbol}
                    onChange={e => setSymbol(e.target.value.toUpperCase())}
                />
                <div className="spacer" />
                {status === 'OPEN' && rows.length > 0 && (
                    <span className="muted">
                        {rows.length} open · {num(exposure)} lots · floating <PnL value={floating} />
                    </span>
                )}
            </div>

            {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
            {list.loading ? <Loading /> : !rows.length ? (
                <div className="card empty">Nothing {status.toLowerCase()}.</div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Symbol</th><th>Side</th><th className="num">Volume</th>
                                <th className="num">Entry</th><th className="num">SL / TP</th>
                                <th className="num">Floating</th>
                                <th>User</th><th>Opened</th><th style={{ width: 1 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(p => (
                                <tr key={p.id || p._id}>
                                    <td>
                                        <strong>{p.symbol}</strong>
                                        {p.venue === 'CTRADER' && <span className="pill" style={{ marginLeft: 6 }}>BROKER</span>}
                                    </td>
                                    <td><span className={`pill ${p.side === 'BUY' ? 'buy' : 'sell'}`}>{p.side}</span></td>
                                    <td className="num">{p.volume}</td>
                                    <td className="num">{p.entryPrice}</td>
                                    <td className="num muted">
                                        {p.stopLoss ?? '—'} / {p.takeProfit ?? '—'}
                                    </td>
                                    <td className="num">
                                        {p.status === 'OPEN' ? <PnL value={p.unrealized} /> : <span className="muted">{money((p as any).finalProfit)}</span>}
                                    </td>
                                    <td>
                                        {p.username
                                            ? <Link to={`/users/${p.userId}`}>{p.username}</Link>
                                            : <span className="muted mono">{String(p.userId).slice(0, 8)}</span>}
                                    </td>
                                    <td className="muted">{when(p.openTime)}</td>
                                    <td>
                                        {p.status === 'OPEN' && p.venue !== 'CTRADER' && (
                                            <button className="small danger" onClick={() => close(p)}>Close</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}
