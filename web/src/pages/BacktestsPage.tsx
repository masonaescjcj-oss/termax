import { useState } from 'react';
import { api, data } from '../api';
import { Empty, Modal, Spinner, pnlClass, signed, useLoader, useToast, when } from '../components/ui';
import { BacktestStrip } from './BotsPage';

type Backtest = { id: string; name: string; botId: string | null; spec: any; fromTs: string; toTs: string; status: string; summary: any; result: any; error: string | null; createdAt: string; finishedAt: string | null };

export function BacktestsPage() {
    const toast = useToast();
    const list = useLoader<Backtest[]>(() => data('/backtests'), [], { every: 15_000 });
    const bots = useLoader<any[]>(() => data('/bots'), []);
    const [open, setOpen] = useState<string | null>(null);
    const [run, setRun] = useState(false);

    const remove = async (b: Backtest) => {
        if (!window.confirm(`Delete backtest "${b.name}"?`)) return;
        try { await api(`/backtests/${b.id}`, { method: 'DELETE' }); list.reload(); } catch (e: any) { toast(e.message, 'err'); }
    };

    return (
        <div className="page"><div className="page-inner">
            <div className="page-head">
                <div><h1>Backtests</h1><p>Every result carries an honesty grade — how much the numbers can be trusted, not just how big they are.</p></div>
                <button className="btn primary" onClick={() => setRun(true)} disabled={!bots.data?.length}>+ Run backtest</button>
            </div>
            {list.loading ? <Spinner dark /> : !list.data?.length ? <Empty title="No backtests yet" text={bots.data?.length ? 'Run one against any of your bots.' : 'Create a bot first — backtests run on a bot\'s rules.'} /> : (
                <table className="grid">
                    <thead><tr><th>Name</th><th>Market</th><th>Period</th><th>Status</th><th>Grade</th><th className="r">Trades</th><th className="r">Win rate</th><th className="r">Net</th><th></th></tr></thead>
                    <tbody>
                        {list.data.map(b => {
                            const s = b.summary ?? b.result?.stats ?? {};
                            return (
                                <tr key={b.id}>
                                    <td className="strong">{b.name}</td>
                                    <td>{b.spec?.symbol} · {b.spec?.timeframe}</td>
                                    <td className="muted">{new Date(b.fromTs).toLocaleDateString('en-GB')} → {new Date(b.toTs).toLocaleDateString('en-GB')}</td>
                                    <td><span className={`chip ${b.status === 'DONE' || b.status === 'COMPLETED' ? 'green' : b.status === 'FAILED' ? 'red' : 'blue'}`}>{b.status.toLowerCase()}</span></td>
                                    <td>{s.grade ?? '—'}</td>
                                    <td className="r">{s.trades ?? '—'}</td>
                                    <td className="r">{s.winRate != null ? `${Number(s.winRate).toFixed(0)}%` : '—'}</td>
                                    <td className={`r strong ${pnlClass(s.netProfit)}`}>{signed(s.netProfit)}</td>
                                    <td className="r"><button className="link-btn" onClick={() => setOpen(b.id)}>Open</button><button className="link-btn red" style={{ marginLeft: 10 }} onClick={() => remove(b)}>Delete</button></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
            {open && <Detail id={open} onClose={() => setOpen(null)} />}
            {run && <RunDialog bots={bots.data ?? []} onClose={() => setRun(false)} onStarted={() => { setRun(false); list.reload(); }} />}
        </div></div>
    );
}

function RunDialog({ bots, onClose, onStarted }: { bots: any[]; onClose: () => void; onStarted: () => void }) {
    const [botId, setBotId] = useState(bots[0]?.id ?? '');
    const [days, setDays] = useState('90');
    const [balance, setBalance] = useState('10000');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const start = async () => {
        setBusy(true); setErr(null);
        try {
            await api('/backtests', { method: 'POST', body: { botId, days: Number(days) || 90, startBalance: Number(balance) || 10000 } });
            onStarted();
        } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
    };
    return (
        <Modal title="Run backtest" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !botId} onClick={start}>{busy ? <span className="spinner" /> : 'Run'}</button></>}>
            <div className="field"><label>Bot</label><select className="box" value={botId} onChange={e => setBotId(e.target.value)}>{bots.map(b => <option key={b.id} value={b.id}>{b.name} — {b.spec?.symbol} {b.spec?.timeframe}</option>)}</select></div>
            <div className="row" style={{ gap: 10, marginTop: 10 }}>
                <div className="field grow"><label>Lookback (days)</label><input className="box" value={days} onChange={e => setDays(e.target.value)} inputMode="numeric" /></div>
                <div className="field grow"><label>Starting balance ($)</label><input className="box" value={balance} onChange={e => setBalance(e.target.value)} inputMode="numeric" /></div>
            </div>
            {err && <div className="note err" style={{ marginTop: 10 }}>{err}</div>}
        </Modal>
    );
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
    const bt = useLoader<Backtest>(() => data(`/backtests/${id}`), [id]);
    const b = bt.data;
    const r = b?.result;
    return (
        <Modal title={b?.name ?? 'Backtest'} onClose={onClose} wide>
            {bt.loading ? <Spinner dark /> : !b ? <div className="note err">{bt.error}</div> : (
                <>
                    <div className="muted small">{b.spec?.symbol} · {b.spec?.timeframe} · {when(b.createdAt)}{b.finishedAt ? ` → finished ${when(b.finishedAt)}` : ''}</div>
                    {b.error && <div className="note err" style={{ marginTop: 10 }}>{b.error}</div>}
                    <BacktestStrip s={{ ...(r?.stats ?? {}), ...(b.summary ?? {}) }} grade={b.summary?.grade} />
                    {r?.equityCurve?.length > 1 && <Equity points={r.equityCurve} />}
                    {!!r?.warnings?.length && <div className="warn" style={{ marginTop: 12 }}><b>Honesty notes</b><ul>{r.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul></div>}
                    {!!r?.trades?.length && (
                        <>
                            <div className="section-title" style={{ paddingLeft: 0 }}>Trades ({r.trades.length})</div>
                            <div style={{ maxHeight: 300, overflow: 'auto' }}>
                                <table className="grid">
                                    <thead><tr><th>Side</th><th>Entry</th><th className="r">Price</th><th>Exit</th><th className="r">Price</th><th>Reason</th><th className="r">Net</th></tr></thead>
                                    <tbody>{r.trades.slice(0, 300).map((t: any, i: number) => (
                                        <tr key={i}><td><span className={`side ${t.side}`}>{t.side}</span></td><td className="muted">{when(t.entryTime)}</td><td className="r">{t.entryPrice ?? t.entryExec}</td><td className="muted">{when(t.exitTime)}</td><td className="r">{t.exitPrice ?? t.exitExec}</td><td>{t.reason ?? t.exitReason ?? ''}</td><td className={`r ${pnlClass(t.netProfit ?? t.net)}`}>{signed(t.netProfit ?? t.net)}</td></tr>
                                    ))}</tbody>
                                </table>
                            </div>
                        </>
                    )}
                </>
            )}
        </Modal>
    );
}

/** A minimal equity curve — SVG, no dependency. */
function Equity({ points }: { points: Array<{ time?: number; timestamp?: number; equity?: number; balance?: number; value?: number }> }) {
    const ys = points.map(p => Number(p.equity ?? p.balance ?? p.value ?? 0));
    const min = Math.min(...ys), max = Math.max(...ys);
    const W = 800, H = 160;
    const d = ys.map((y, i) => `${i === 0 ? 'M' : 'L'}${(i / (ys.length - 1)) * W},${H - ((y - min) / (max - min || 1)) * (H - 10) - 5}`).join(' ');
    const up = ys[ys.length - 1] >= ys[0];
    return (
        <div style={{ marginTop: 14, border: '1px solid var(--line)', borderRadius: 8, padding: 8, background: 'var(--panel)' }}>
            <div className="row small muted" style={{ justifyContent: 'space-between' }}><span>Equity curve</span><span>{ys[0].toFixed(0)} → <b className={up ? 'up' : 'down'}>{ys[ys.length - 1].toFixed(0)}</b></span></div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none"><path d={d} fill="none" stroke={up ? '#089981' : '#f23645'} strokeWidth="1.5" /></svg>
        </div>
    );
}
