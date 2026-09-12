/**
 * Portfolio & risk: currency exposure, what happens if every stop is hit,
 * correlated clusters, Trade DNA findings and the weekly digest.
 */
import { useState } from 'react';
import { api, data } from '../api';
import { Empty, Spinner, money, pct, pnlClass, signed, useLoader, useToast } from '../components/ui';

const sevClass = (s: string) => (s === 'ALERT' || s === 'HIGH' ? 'red' : s === 'WARN' || s === 'MEDIUM' ? 'amber' : '');

export function PortfolioPage() {
    const port = useLoader<any>(() => data('/insights/portfolio'), [], { every: 30_000 });
    const dna = useLoader<any>(() => data('/insights/dna'), []);
    const digest = useLoader<any>(() => data('/insights/digest'), []);
    const guard = useLoader<any>(() => data('/insights/risk-guard'), []);
    const p = port.data;

    return (
        <div className="page"><div className="page-inner">
            <div className="page-head"><div><h1>Portfolio &amp; risk</h1><p>What you are actually exposed to, and the habits your trades reveal.</p></div></div>
            {port.loading && !p ? <Spinner dark /> : !p ? <Empty title="Portfolio unavailable" text={port.error || undefined} /> : (
                <>
                    <div className="stats">
                        <div className="stat"><span>Open positions</span><b>{p.positions}</b></div>
                        <div className="stat"><span>Gross exposure</span><b>{money(p.exposure?.gross, 0)}</b></div>
                        <div className="stat"><span>If all stops hit</span><b className="down">{signed(-Math.abs(p.risk?.ifAllStopsHit ?? 0))}{p.risk?.ifAllStopsHitPct != null ? <span className="muted small"> ({pct(-Math.abs(p.risk.ifAllStopsHitPct))})</span> : null}</b></div>
                        <div className="stat"><span>Without a stop</span><b className={p.risk?.unstopped?.length ? 'down' : ''}>{p.risk?.unstopped?.length ?? 0}</b></div>
                    </div>
                    <div className="two">
                        <div className="card">
                            <h3>Currency exposure</h3>
                            {!p.exposure?.legs?.length ? <div className="muted">No open positions.</div> : p.exposure.legs.map((l: any) => {
                                const net = Number(l.net ?? l.notional ?? 0);
                                const max = Math.max(...p.exposure.legs.map((x: any) => Math.abs(Number(x.net ?? x.notional ?? 0))), 1);
                                return (
                                    <div key={l.currency} className="row" style={{ padding: '6px 0', gap: 12 }}>
                                        <b style={{ width: 44 }}>{l.currency}</b>
                                        <div className="bar grow"><i style={{ width: `${(Math.abs(net) / max) * 100}%`, background: net >= 0 ? 'var(--green)' : 'var(--red)' }} /></div>
                                        <span className={`num ${pnlClass(net)}`} style={{ width: 100, textAlign: 'right' }}>{net >= 0 ? 'long' : 'short'} {money(Math.abs(net), 0)}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="card">
                            <h3>Correlated clusters</h3>
                            {!p.clusters?.filter((c: string[]) => c.length > 1).length ? <div className="muted">No two open positions move together strongly.</div> : p.clusters.filter((c: string[]) => c.length > 1).map((c: string[], i: number) => (
                                <div key={i} className="row" style={{ gap: 6, padding: '6px 0', flexWrap: 'wrap' }}>{c.map(s => <span key={s} className="chip amber">{s}</span>)}<span className="muted small">move together — one idea, not {c.length}</span></div>
                            ))}
                            {!!p.correlations?.length && (
                                <table className="grid" style={{ marginTop: 8 }}>
                                    <thead><tr><th>Pair</th><th className="r">Correlation</th><th className="r">Days</th></tr></thead>
                                    <tbody>{p.correlations.slice(0, 8).map((c: any) => <tr key={`${c.a}${c.b}`}><td>{c.a} / {c.b}</td><td className={`r ${Math.abs(c.r) > 0.7 ? 'down' : ''}`}>{Number(c.r).toFixed(2)}</td><td className="r muted">{c.days}</td></tr>)}</tbody>
                                </table>
                            )}
                        </div>
                    </div>
                    {!!p.findings?.length && (
                        <div className="card" style={{ marginTop: 16 }}>
                            <h3>Findings</h3>
                            {p.findings.map((f: any) => <div key={f.key} className="row" style={{ padding: '6px 0', alignItems: 'flex-start' }}><span className={`chip ${sevClass(f.severity)}`}>{f.severity}</span><span>{f.en}</span></div>)}
                        </div>
                    )}
                </>
            )}
            <div className="two" style={{ marginTop: 16 }}>
                <div className="card">
                    <h3>Trade DNA</h3>
                    {dna.loading ? <Spinner dark /> : !dna.data ? <div className="muted">Not enough closed trades yet.</div> : (
                        <>
                            <div className="sub">Based on {dna.data.trades} closed trades</div>
                            {!dna.data.findings?.length && <div className="muted" style={{ marginTop: 8 }}>No harmful pattern found yet. Keep trading — the profile sharpens with data.</div>}
                            {dna.data.findings?.map((f: any) => <div key={f.key} className="row" style={{ padding: '8px 0', alignItems: 'flex-start', borderTop: '1px solid var(--line-soft)' }}><span className={`chip ${sevClass(f.severity)}`}>{f.severity}</span><span style={{ fontSize: 12 }}>{f.en}</span></div>)}
                            {!!dna.data.hourly?.length && <Hourly buckets={dna.data.hourly} />}
                        </>
                    )}
                </div>
                <div>
                    <div className="card">
                        <h3>Weekly digest</h3>
                        {digest.loading ? <Spinner dark /> : !digest.data ? <div className="muted">Comes after your first week of trades.</div> : (
                            <>
                                <div className="row" style={{ gap: 18, marginTop: 6 }}>
                                    <div><div className="muted small">Trades</div><b>{digest.data.manual?.trades ?? 0}</b></div>
                                    <div><div className="muted small">Win rate</div><b>{digest.data.manual?.winRate != null ? `${Number(digest.data.manual.winRate).toFixed(0)}%` : '—'}</b></div>
                                    <div><div className="muted small">Net</div><b className={pnlClass(digest.data.manual?.netProfit)}>{signed(digest.data.manual?.netProfit)}</b></div>
                                    <div><div className="muted small">Bots net</div><b className={pnlClass(digest.data.botsNet)}>{signed(digest.data.botsNet)}</b></div>
                                </div>
                                {digest.data.focus?.en && <div className="note" style={{ marginTop: 10, color: 'var(--text)' }}><b className="muted small">Focus for next week</b><div>{digest.data.focus.en}</div></div>}
                            </>
                        )}
                    </div>
                    <RiskGuard state={guard.data} loading={guard.loading} onSaved={guard.reload} />
                </div>
            </div>
        </div></div>
    );
}

function Hourly({ buckets }: { buckets: any[] }) {
    const max = Math.max(...buckets.map(b => Math.abs(Number(b.netProfit ?? b.net ?? 0))), 1);
    return (
        <div style={{ marginTop: 12 }}>
            <div className="muted small" style={{ marginBottom: 4 }}>Net P/L by entry hour (UTC)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 2 }}>
                {Array.from({ length: 24 }).map((_, h) => {
                    const b = buckets.find(x => Number(x.hour ?? x.key ?? x.label) === h);
                    const v = Number(b?.netProfit ?? b?.net ?? 0);
                    const a = Math.abs(v) / max;
                    return <div key={h} title={`${h}:00 — ${signed(v)} (${b?.trades ?? 0} trades)`} style={{ height: 22, borderRadius: 3, background: v === 0 ? 'var(--panel-3)' : v > 0 ? `rgba(8,153,129,${0.2 + a * 0.8})` : `rgba(242,54,69,${0.2 + a * 0.8})` }} />;
                })}
            </div>
        </div>
    );
}

function RiskGuard({ state, loading, onSaved }: { state: any; loading: boolean; onSaved: () => void }) {
    const toast = useToast();
    const cfg = state?.config ?? state ?? {};
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [lossPct, setLossPct] = useState<string | null>(null);
    const [losses, setLosses] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const en = enabled ?? !!cfg.enabled;
    const save = async () => {
        setBusy(true);
        try {
            await api('/insights/risk-guard', { method: 'POST', body: { enabled: en, maxDailyLossPct: Number(lossPct ?? cfg.maxDailyLossPct ?? 3), maxDailyLosses: Number(losses ?? cfg.maxDailyLosses ?? 3) } });
            toast('Risk guard saved', 'ok'); onSaved();
        } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
    };
    return (
        <div className="card" style={{ marginTop: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>Risk guard</h3>{state?.state?.locked && <span className="chip red">locked for today</span>}</div>
            <div className="sub" style={{ marginTop: 4 }}>Refuses new orders once today's loss reaches a limit. Opt-in — it says no, so nobody gets it by surprise.</div>
            {loading ? <Spinner dark /> : (
                <>
                    <label className="row" style={{ marginTop: 12, gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={en} onChange={e => setEnabled(e.target.checked)} /> Enabled</label>
                    <div className="row" style={{ gap: 10, marginTop: 10 }}>
                        <div className="field grow"><label>Max daily loss (% of balance)</label><input className="box" value={lossPct ?? String(cfg.maxDailyLossPct ?? 3)} onChange={e => setLossPct(e.target.value)} inputMode="decimal" /></div>
                        <div className="field grow"><label>Max losing trades a day</label><input className="box" value={losses ?? String(cfg.maxDailyLosses ?? 3)} onChange={e => setLosses(e.target.value)} inputMode="numeric" /></div>
                    </div>
                    <button className="btn primary sm" style={{ marginTop: 10 }} disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : 'Save'}</button>
                </>
            )}
        </div>
    );
}
