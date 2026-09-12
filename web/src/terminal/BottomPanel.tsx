/**
 * The book under the chart: open positions marked live against the feed,
 * pending orders, closed history, and the account strip. Close and modify
 * go straight to the server and re-pull the book.
 */
import { useMemo, useState } from 'react';
import { api } from '../api';
import { Empty, Field, Modal, NumberInput, money, pnlClass, signed, useToast, when } from '../components/ui';
import { useQuotes } from '../market';
import { digitsFor, fmtPrice } from '../symbols';
import { markPnL, refreshAllBooks, type AccountState, type Position } from './account';

type Tab = 'positions' | 'orders' | 'history';

export function BottomPanel({ positions, account, accountId, loaded, error, onPickSymbol }: {
    positions: Position[]; account: AccountState | null; accountId: string; loaded: boolean; error: string | null; onPickSymbol: (s: string) => void;
}) {
    const toast = useToast();
    const [tab, setTab] = useState<Tab>('positions');
    const [modify, setModify] = useState<Position | null>(null);
    const [closing, setClosing] = useState<string | null>(null);
    const [closeDlg, setCloseDlg] = useState<Position | null>(null);

    const open = useMemo(() => positions.filter(p => p.status === 'OPEN'), [positions]);
    const pending = useMemo(() => positions.filter(p => p.status === 'PENDING'), [positions]);
    const closed = useMemo(() => positions.filter(p => p.status === 'CLOSED').sort((a, b) => new Date(b.closeTime || 0).getTime() - new Date(a.closeTime || 0).getTime()).slice(0, 200), [positions]);
    const quotes = useQuotes(useMemo(() => [...new Set(open.map(p => p.symbol))], [open]));

    const floating = open.reduce((s, p) => s + (markPnL(p, quotes[p.symbol]?.bid, quotes[p.symbol]?.ask) ?? 0), 0);
    const equity = account ? account.balance + floating : null;

    const close = async (p: Position, volume?: number) => {
        setClosing(p.id);
        try {
            const body: any = { positionId: p.id, accountId, currentPrice: p.side === 'BUY' ? quotes[p.symbol]?.bid : quotes[p.symbol]?.ask };
            if (volume && volume < p.volume) body.volume = volume;
            await api('/trade/close', { method: 'POST', body });
            toast(p.status === 'PENDING' ? `Order cancelled: ${p.symbol}` : volume && volume < p.volume ? `Closed ${volume.toFixed(2)} of ${p.volume.toFixed(2)} ${p.symbol}` : `Position closed: ${p.symbol}`, 'ok');
            refreshAllBooks();
        } catch (e: any) { toast(e.message, 'err'); } finally { setClosing(null); }
    };

    const closeAll = async () => {
        if (!open.length || !window.confirm(`Close all ${open.length} open positions at market?`)) return;
        for (const p of open) await close(p);
    };

    return (
        <>
            <div className="tabs">
                <button className={tab === 'positions' ? 'active' : ''} onClick={() => setTab('positions')}>Positions{open.length ? <span className="count">{open.length}</span> : null}</button>
                <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Orders{pending.length ? <span className="count">{pending.length}</span> : null}</button>
                <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>History</button>
                <span className="spacer" />
                {tab === 'positions' && open.length > 0 && <button className="link-btn red" onClick={closeAll}>Close all</button>}
            </div>
            <div className="panel-body">
                {error && !loaded && <div className="note err" style={{ margin: 10 }}>{error}</div>}
                {tab === 'positions' && (open.length === 0 ? <Empty title="No open positions" text="Use the Trade button or the order panel to place your first order." /> : (
                    <table className="grid">
                        <thead><tr><th>Symbol</th><th>Side</th><th className="r">Volume</th><th className="r">Entry</th><th className="r">Market</th><th className="r">S/L</th><th className="r">T/P</th><th className="r">Swap</th><th className="r">P/L</th><th>Opened</th><th></th></tr></thead>
                        <tbody>
                            {open.map(p => {
                                const qt = quotes[p.symbol];
                                const mk = p.side === 'BUY' ? qt?.bid : qt?.ask;
                                const pnl = markPnL(p, qt?.bid, qt?.ask);
                                return (
                                    <tr key={p.id}>
                                        <td><button className="strong" onClick={() => onPickSymbol(p.symbol)}>{p.symbol}</button>{p.botId && <span className="chip blue" style={{ marginLeft: 6 }}>bot</span>}</td>
                                        <td><span className={`side ${p.side}`}>{p.side}</span></td>
                                        <td className="r">{p.volume.toFixed(2)}</td>
                                        <td className="r">{fmtPrice(p.symbol, p.entryPrice)}</td>
                                        <td className="r">{fmtPrice(p.symbol, mk ?? p.marketPrice)}</td>
                                        <td className="r">{p.stopLoss ? fmtPrice(p.symbol, p.stopLoss) : <span className="muted">—</span>}</td>
                                        <td className="r">{p.takeProfit ? fmtPrice(p.symbol, p.takeProfit) : <span className="muted">—</span>}</td>
                                        <td className="r muted">{p.swap ? p.swap.toFixed(2) : '0.00'}</td>
                                        <td className={`r strong ${pnlClass(pnl)}`}>{signed(pnl)}</td>
                                        <td className="muted">{when(p.openTime)}</td>
                                        <td className="r">
                                            <button className="link-btn" onClick={() => setModify(p)}>Modify</button>
                                            <button className="link-btn red" style={{ marginLeft: 10 }} disabled={closing === p.id} onClick={() => setCloseDlg(p)}>{closing === p.id ? '…' : 'Close'}</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ))}
                {tab === 'orders' && (pending.length === 0 ? <Empty title="No pending orders" text="Limit and stop orders wait here until they fill." /> : (
                    <table className="grid">
                        <thead><tr><th>Symbol</th><th>Side</th><th>Type</th><th className="r">Volume</th><th className="r">Price</th><th className="r">S/L</th><th className="r">T/P</th><th>Placed</th><th></th></tr></thead>
                        <tbody>
                            {pending.map(p => (
                                <tr key={p.id}>
                                    <td><button className="strong" onClick={() => onPickSymbol(p.symbol)}>{p.symbol}</button></td>
                                    <td><span className={`side ${p.side}`}>{p.side}</span></td>
                                    <td>{p.orderType}</td>
                                    <td className="r">{p.volume.toFixed(2)}</td>
                                    <td className="r">{fmtPrice(p.symbol, p.entryPrice)}</td>
                                    <td className="r">{p.stopLoss ? fmtPrice(p.symbol, p.stopLoss) : '—'}</td>
                                    <td className="r">{p.takeProfit ? fmtPrice(p.symbol, p.takeProfit) : '—'}</td>
                                    <td className="muted">{when(p.openTime)}</td>
                                    <td className="r"><button className="link-btn" onClick={() => setModify(p)}>Modify</button><button className="link-btn red" style={{ marginLeft: 10 }} onClick={() => close(p)}>Cancel</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ))}
                {tab === 'history' && (closed.length === 0 ? <Empty title="No closed trades yet" /> : (
                    <table className="grid">
                        <thead><tr><th>Symbol</th><th>Side</th><th className="r">Volume</th><th className="r">Entry</th><th className="r">Exit</th><th className="r">Commission</th><th className="r">Swap</th><th className="r">Net P/L</th><th>Opened</th><th>Closed</th></tr></thead>
                        <tbody>
                            {closed.map(p => (
                                <tr key={p.id}>
                                    <td><button className="strong" onClick={() => onPickSymbol(p.symbol)}>{p.symbol}</button>{p.botId && <span className="chip blue" style={{ marginLeft: 6 }}>bot</span>}</td>
                                    <td><span className={`side ${p.side}`}>{p.side}</span></td>
                                    <td className="r">{p.volume.toFixed(2)}</td>
                                    <td className="r">{fmtPrice(p.symbol, p.entryPrice)}</td>
                                    <td className="r">{fmtPrice(p.symbol, p.closePrice)}</td>
                                    <td className="r muted">{(p.commission || 0).toFixed(2)}</td>
                                    <td className="r muted">{(p.swap || 0).toFixed(2)}</td>
                                    <td className={`r strong ${pnlClass(p.finalProfit)}`}>{signed(p.finalProfit)}</td>
                                    <td className="muted">{when(p.openTime)}</td>
                                    <td className="muted">{when(p.closeTime)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ))}
            </div>
            <div className="acct-strip">
                <div><span>Balance</span><b>{money(account?.balance)}</b></div>
                <div><span>Equity</span><b>{money(equity ?? account?.equity)}</b></div>
                <div><span>Floating P/L</span><b className={pnlClass(floating)}>{signed(floating)}</b></div>
                <div><span>Margin</span><b>{money(account?.margin)}</b></div>
                <div><span>Free margin</span><b>{money(account?.freeMargin)}</b></div>
                <div><span>Margin level</span><b>{account?.marginLevel ? `${account.marginLevel.toFixed(0)}%` : '—'}</b></div>
                <div><span>Leverage</span><b>1:{account?.leverage ?? '—'}</b></div>
            </div>
            {modify && <ModifyDialog p={modify} accountId={accountId} onClose={() => setModify(null)} />}
            {closeDlg && <CloseDialog p={closeDlg} pnl={markPnL(closeDlg, quotes[closeDlg.symbol]?.bid, quotes[closeDlg.symbol]?.ask)} onClose={() => setCloseDlg(null)} onConfirm={vol => { const p = closeDlg; setCloseDlg(null); void close(p, vol); }} />}
        </>
    );
}

function ModifyDialog({ p, accountId, onClose }: { p: Position; accountId: string; onClose: () => void }) {
    const toast = useToast();
    const digits = digitsFor(p.symbol, p.entryPrice);
    const step = Math.pow(10, -digits);
    const [sl, setSl] = useState(p.stopLoss ? p.stopLoss.toFixed(digits) : '');
    const [tp, setTp] = useState(p.takeProfit ? p.takeProfit.toFixed(digits) : '');
    const [trail, setTrail] = useState(p.trailingStopDistance ? String(p.trailingStopDistance) : '');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const save = async () => {
        const slN = sl === '' ? null : parseFloat(sl);
        const tpN = tp === '' ? null : parseFloat(tp);
        if (slN != null && (p.side === 'BUY' ? slN >= p.entryPrice : slN <= p.entryPrice)) { setErr(`Stop loss must be ${p.side === 'BUY' ? 'below' : 'above'} the entry.`); return; }
        if (tpN != null && (p.side === 'BUY' ? tpN <= p.entryPrice : tpN >= p.entryPrice)) { setErr(`Take profit must be ${p.side === 'BUY' ? 'above' : 'below'} the entry.`); return; }
        setBusy(true); setErr(null);
        try {
            await api('/trade/modify', { method: 'POST', body: { positionId: p.id, accountId, stopLoss: slN, takeProfit: tpN, trailingStopDistance: trail === '' ? 0 : parseFloat(trail) || 0 } });
            toast('Position updated', 'ok');
            refreshAllBooks();
            onClose();
        } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
    };

    return (
        <Modal title={`Modify ${p.side} ${p.volume} ${p.symbol}`} onClose={onClose}
            footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : 'Save'}</button></>}>
            <div className="kv" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><span className="muted">Entry</span><b>{fmtPrice(p.symbol, p.entryPrice)}</b></div>
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <Field label="Stop loss" hint="Leave empty for none"><NumberInput value={sl} onChange={setSl} step={step} digits={digits} placeholder="—" /></Field>
                <Field label="Take profit"><NumberInput value={tp} onChange={setTp} step={step} digits={digits} placeholder="—" /></Field>
            </div>
            <div style={{ marginTop: 10 }}>
                <Field label="Trailing stop distance (price units)" hint="Moves the stop behind price once in profit. 0 disables."><NumberInput value={trail} onChange={setTrail} step={step * 10} digits={digits} placeholder="0" /></Field>
            </div>
            {err && <div className="note err" style={{ marginTop: 10 }}>{err}</div>}
        </Modal>
    );
}

/** Close all of it, or part of it — the server splits the position for a partial. */
function CloseDialog({ p, pnl, onClose, onConfirm }: { p: Position; pnl: number | null; onClose: () => void; onConfirm: (volume: number) => void }) {
    const [vol, setVol] = useState(p.volume.toFixed(2));
    const v = parseFloat(vol) || 0;
    const valid = v > 0 && v <= p.volume + 1e-9;
    const partial = valid && v < p.volume - 1e-9;
    const share = valid ? Math.min(1, v / p.volume) : 0;
    return (
        <Modal title={`Close ${p.side} ${p.volume.toFixed(2)} ${p.symbol}`} onClose={onClose}
            footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn sell" disabled={!valid} onClick={() => onConfirm(v)}>{partial ? `Close ${v.toFixed(2)} lots` : 'Close position'}</button></>}>
            <div className="kv" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><span className="muted">Floating P/L</span><b className={pnlClass(pnl)}>{signed(pnl)}{partial && pnl != null ? <span className="muted"> → realise ≈ {signed(pnl * share)}</span> : null}</b></div>
            <Field label="Volume to close (lots)" error={!valid && vol !== '' ? `Between 0.01 and ${p.volume.toFixed(2)}` : null}>
                <NumberInput value={vol} onChange={setVol} step={0.01} min={0.01} max={p.volume} digits={2} />
            </Field>
            <div className="row" style={{ gap: 6, marginTop: 10 }}>
                {[0.25, 0.5, 0.75, 1].map(f => (
                    <button key={f} className={`btn ghost sm ${Math.abs(share - f) < 1e-6 ? 'active' : ''}`} onClick={() => setVol(Math.max(0.01, Math.round(p.volume * f * 100) / 100).toFixed(2))}>{f === 1 ? 'All' : `${f * 100}%`}</button>
                ))}
            </div>
            {partial && <div className="note" style={{ marginTop: 12 }}>The rest ({(p.volume - v).toFixed(2)} lots) stays open with the same stop and target.</div>}
        </Modal>
    );
}
