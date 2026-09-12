/**
 * Strategy bots: build one from a sentence with MaxAI, forward-test it on
 * paper, read its report, and take it live once the gate says so.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, data } from '../api';
import { accountIdOf, primaryAccount, useAuth } from '../auth';
import { Empty, Modal, Spinner, money, pnlClass, signed, useLoader, useToast, when } from '../components/ui';

type Bot = { id: string; name: string; status: 'STOPPED' | 'FORWARD_TEST' | 'LIVE'; origin: string; spec: any; startedAt: string | null; createdAt: string; stats: { trades: number; netProfit: number; openPosition: any } };

export function BotsPage() {
    const toast = useToast();
    const nav = useNavigate();
    const { user } = useAuth();
    const accountId = accountIdOf(primaryAccount(user));
    const bots = useLoader<Bot[]>(() => data('/bots'), [], { every: 30_000 });
    const [build, setBuild] = useState(false);
    const [report, setReport] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const act = async (bot: Bot, action: 'start' | 'stop' | 'go-live' | 'delete') => {
        if (action === 'delete' && !window.confirm(`Delete "${bot.name}"? Its trade history stays in the journal.`)) return;
        setBusy(bot.id);
        try {
            if (action === 'delete') await api(`/bots/${bot.id}`, { method: 'DELETE' });
            else await api(`/bots/${bot.id}/${action}`, { method: 'POST', body: { accountId } });
            toast(action === 'start' ? `${bot.name} is forward-testing` : action === 'stop' ? `${bot.name} stopped` : action === 'go-live' ? `${bot.name} is live` : 'Bot deleted', 'ok');
            bots.reload();
        } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(null); }
    };

    return (
        <div className="page"><div className="page-inner">
            <div className="page-head">
                <div><h1>Bots</h1><p>Describe a strategy in plain English. MaxAI turns it into rules, paper-trades it, and grades it before real money.</p></div>
                <button className="btn primary" onClick={() => setBuild(true)}>+ New bot</button>
            </div>
            {bots.loading ? <Spinner dark /> : !bots.data?.length ? <Empty title="No bots yet" text="Click New bot and describe what you would trade." /> : (
                <div className="cards">
                    {bots.data.map(b => (
                        <div key={b.id} className="card">
                            <div className="row" style={{ justifyContent: 'space-between' }}>
                                <h3 style={{ margin: 0 }}><span className={`status-dot ${b.status === 'FORWARD_TEST' ? 'PAPER' : b.status}`} />{b.name}</h3>
                                <span className={`chip ${b.status === 'LIVE' ? 'green' : b.status === 'FORWARD_TEST' ? 'blue' : ''}`}>{b.status === 'FORWARD_TEST' ? 'Paper' : b.status[0] + b.status.slice(1).toLowerCase()}</span>
                            </div>
                            <div className="sub" style={{ marginTop: 4 }}>{b.spec?.symbol} · {b.spec?.timeframe} · {b.origin === 'AI' ? 'built by MaxAI' : b.origin.toLowerCase()}</div>
                            <div className="row" style={{ marginTop: 12, gap: 18 }}>
                                <div><div className="muted small">Trades</div><b>{b.stats.trades}</b></div>
                                <div><div className="muted small">Net P/L</div><b className={pnlClass(b.stats.netProfit)}>{signed(b.stats.netProfit)}</b></div>
                                <div><div className="muted small">{b.status === 'STOPPED' ? 'Created' : 'Running since'}</div><b>{when(b.status === 'STOPPED' ? b.createdAt : b.startedAt)}</b></div>
                            </div>
                            {b.stats.openPosition && <div className="note" style={{ marginTop: 10 }}>Open: {b.stats.openPosition.side} {b.stats.openPosition.symbol} @ {b.stats.openPosition.entryPrice}</div>}
                            <div className="row" style={{ marginTop: 12, gap: 6, flexWrap: 'wrap' }}>
                                {b.status === 'STOPPED' ? <button className="btn primary sm" disabled={busy === b.id} onClick={() => act(b, 'start')}>Start paper</button>
                                    : <button className="btn ghost sm" disabled={busy === b.id} onClick={() => act(b, 'stop')}>Stop</button>}
                                {b.status === 'FORWARD_TEST' && <button className="btn ghost sm" disabled={busy === b.id} onClick={() => act(b, 'go-live')}>Go live</button>}
                                <button className="btn ghost sm" onClick={() => setReport(b.id)}>Report</button>
                                <button className="btn ghost sm" onClick={() => nav(`/chart/${encodeURIComponent(b.spec?.symbol?.replace('/', '-') ?? 'BTC-USDT')}?bot=${b.id}`)}>On chart</button>
                                <button className="btn ghost sm" onClick={() => nav(`/replay?symbol=${encodeURIComponent(b.spec?.symbol ?? 'BTC/USDT')}&tf=${b.spec?.timeframe ?? '15m'}&bot=${b.id}`)}>Replay</button>
                                <span className="grow" />
                                <button className="link-btn red" disabled={busy === b.id} onClick={() => act(b, 'delete')}>Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {build && <BuildDialog onClose={() => setBuild(false)} onBuilt={() => { setBuild(false); bots.reload(); }} accountId={accountId} />}
            {report && <ReportDialog id={report} onClose={() => setReport(null)} />}
        </div></div>
    );
}

function BuildDialog({ onClose, onBuilt, accountId }: { onClose: () => void; onBuilt: () => void; accountId: string }) {
    const toast = useToast();
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState<{ spec: any; rules: string[]; backtest?: any } | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const build = async () => {
        setBusy(true); setErr(null);
        try {
            const d = await data<any>('/bots/build', { method: 'POST', body: { description: text, days: 90, save: false } });
            setDraft({ spec: d.spec, rules: d.rules ?? [], backtest: d.backtest ?? d.summary ?? null });
        } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
    };
    const save = async () => {
        if (!draft) return;
        setBusy(true);
        try {
            await api('/bots', { method: 'POST', body: { spec: draft.spec, accountId } });
            toast(`Bot "${draft.spec.name}" created`, 'ok');
            onBuilt();
        } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
    };

    return (
        <Modal title="New bot" onClose={onClose} wide footer={
            draft ? <><button className="btn ghost" onClick={() => setDraft(null)}>Edit description</button><button className="btn primary" disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : 'Save bot'}</button></>
                : <><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || text.trim().length < 12} onClick={build}>{busy ? <span className="spinner" /> : 'Build with MaxAI'}</button></>
        }>
            {!draft ? (
                <>
                    <p className="muted" style={{ marginTop: 0 }}>Say what to trade, when to enter, and how to exit. Example: <i>"Buy GOLD on the 15m when RSI crosses above 30 and price is above the 50 EMA; stop 20 pips, target 40 pips, max 3 trades a day."</i></p>
                    <textarea className="box" value={text} onChange={e => setText(e.target.value)} placeholder="Describe your strategy…" autoFocus />
                    {err && <div className="note err" style={{ marginTop: 10 }}>{err}</div>}
                </>
            ) : (
                <>
                    <h3 style={{ margin: '0 0 4px' }}>{draft.spec.name}</h3>
                    <div className="muted small">{draft.spec.symbol} · {draft.spec.timeframe}</div>
                    <ul className="rules">{draft.rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
                    {draft.backtest && <BacktestStrip s={draft.backtest.stats ?? draft.backtest} grade={draft.backtest.grade ?? draft.backtest.summary?.grade} />}
                    {err && <div className="note err" style={{ marginTop: 10 }}>{err}</div>}
                </>
            )}
        </Modal>
    );
}

export function BacktestStrip({ s, grade }: { s: any; grade?: string | null }) {
    if (!s) return null;
    return (
        <div className="stats" style={{ marginTop: 14, marginBottom: 0 }}>
            {grade && <div className="stat"><span>Honesty grade</span><b>{grade}</b></div>}
            <div className="stat"><span>Trades</span><b>{s.trades ?? '—'}</b></div>
            <div className="stat"><span>Win rate</span><b>{s.winRate != null ? `${Number(s.winRate).toFixed(0)}%` : '—'}</b></div>
            <div className="stat"><span>Net</span><b className={pnlClass(s.netProfit)}>{signed(s.netProfit)}</b></div>
            <div className="stat"><span>Profit factor</span><b>{s.profitFactor != null ? Number(s.profitFactor).toFixed(2) : '—'}</b></div>
            <div className="stat"><span>Max drawdown</span><b className="down">{s.maxDrawdownPct != null ? `${Number(s.maxDrawdownPct).toFixed(1)}%` : money(s.maxDrawdown)}</b></div>
        </div>
    );
}

function ReportDialog({ id, onClose }: { id: string; onClose: () => void }) {
    const rep = useLoader<any>(() => data(`/bots/${id}/report`), [id]);
    const ev = useLoader<any[]>(() => data(`/bots/events?botId=${id}`).catch(() => []), [id]);
    const r = rep.data;
    return (
        <Modal title={r ? `${r.bot.name} — report` : 'Report'} onClose={onClose} wide>
            {rep.loading ? <Spinner dark /> : !r ? <div className="note err">{rep.error}</div> : (
                <>
                    <div className="muted small">{r.bot.symbol} · {r.bot.status === 'FORWARD_TEST' ? 'paper trading' : r.bot.status.toLowerCase()}{r.bot.startedAt ? ` since ${when(r.bot.startedAt)}` : ''}</div>
                    <ul className="rules">{(r.rules ?? []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
                    <div className="section-title" style={{ paddingLeft: 0 }}>Forward record</div>
                    <BacktestStrip s={r.forward} />
                    {r.backtest && <><div className="section-title" style={{ paddingLeft: 0 }}>Backtest</div><BacktestStrip s={r.backtest} grade={r.backtest.grade} /></>}
                    {r.gate && (
                        <div className={`note ${r.gate.eligible ? 'ok' : ''}`} style={{ marginTop: 14 }}>
                            <b>Live gate: {r.gate.eligible ? 'eligible' : 'not yet'}</b>
                            {r.gate.progress && <div className="small">{r.gate.progress.daysRunning} days · {r.gate.progress.trades} trades (needs {r.gate.requirements?.minDays} days and {r.gate.requirements?.minTrades} trades)</div>}
                            {(r.gate.reasons ?? []).map((x: string, i: number) => <div key={i} className="small">• {x}</div>)}
                        </div>
                    )}
                    {r.watchdog && (
                        <div className="note" style={{ marginTop: 10 }}>Watchdog {r.watchdog.enabled === false ? 'off' : 'on'}{r.watchdog.paused ? ' · paused by a limit' : ''}</div>
                    )}
                    {!!ev.data?.length && (
                        <>
                            <div className="section-title" style={{ paddingLeft: 0 }}>Recent events</div>
                            {ev.data.slice(0, 12).map((e: any) => (
                                <div key={e.id} className="row small" style={{ padding: '4px 0', borderBottom: '1px solid var(--line-soft)' }}>
                                    <span className={`chip ${e.severity === 'ALERT' ? 'red' : e.severity === 'WARN' ? 'amber' : ''}`}>{e.severity}</span>
                                    <span className="grow">{e.messageEn}</span>
                                    <span className="muted">{when(e.createdAt)}</span>
                                </div>
                            ))}
                        </>
                    )}
                </>
            )}
        </Modal>
    );
}
