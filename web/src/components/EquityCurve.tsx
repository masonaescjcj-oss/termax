/**
 * The account over time: what it is worth, how far it has fallen from its
 * own high-water mark, and what each month did.
 *
 * Equity and drawdown are two measures on different scales, so they get
 * two stacked plots sharing one x-axis rather than one chart with two
 * y-axes. One series each: no legend, the heading names it, and the last
 * value is labelled on the line itself.
 */
import { useMemo, useRef, useState } from 'react';
import { data, q } from '../api';
import { Empty, Spinner, money, pct, pnlClass, signed, useLoader, useStored } from './ui';

interface Point { day: string; balance: number; equity: number; realised: number; trades: number; peak: number; drawdown: number; drawdownPct: number; change: number; changePct: number | null }
interface Month { month: string; startEquity: number; endEquity: number; change: number; changePct: number | null; realised: number; trades: number; days: number }
interface History {
    accountId: string; points: Point[]; startEquity: number; endEquity: number; change: number; changePct: number | null;
    peakEquity: number; maxDrawdown: number; maxDrawdownPct: number;
    bestDay: { day: string; change: number } | null; worstDay: { day: string; change: number } | null;
    tradingDays: number; trades: number; realised: number; months: Month[]; sparse: boolean;
}

const RANGES: Array<{ label: string; days: number }> = [
    { label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '6M', days: 180 }, { label: '1Y', days: 365 }, { label: 'All', days: 1000 },
];

const W = 900, H = 190, DD_H = 74, PAD_L = 8, PAD_R = 66, PAD_T = 12, PAD_B = 20;

const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export function EquityCurve({ accountId }: { accountId: string }) {
    const [days, setDays] = useStored('tx.eq.range', 180);
    const hist = useLoader<History>(() => data(q('/trade/history', { accountId, days })), [accountId, days], { every: 120_000 });
    const [hover, setHover] = useState<number | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const h = hist.data;

    const geom = useMemo(() => {
        const pts = h?.points ?? [];
        if (pts.length < 2) return null;
        const equities = pts.map(p => p.equity);
        let min = Math.min(...equities), max = Math.max(...equities);
        // A flat account still deserves a line through the middle rather
        // than a division by zero.
        if (max - min < 1e-9) { min -= 1; max += 1; }
        const pad = (max - min) * 0.08;
        min -= pad; max += pad;
        const x = (i: number) => PAD_L + (i / (pts.length - 1)) * (W - PAD_L - PAD_R);
        const y = (v: number) => PAD_T + (1 - (v - min) / (max - min)) * (H - PAD_T - PAD_B);
        const maxDd = Math.max(1, ...pts.map(p => p.drawdownPct));
        const ddY = (v: number) => 4 + (v / maxDd) * (DD_H - 12);
        return { pts, min, max, x, y, maxDd, ddY };
    }, [h]);

    const onMove = (e: React.MouseEvent) => {
        if (!geom || !svgRef.current) return;
        const box = svgRef.current.getBoundingClientRect();
        const rel = ((e.clientX - box.left) / box.width) * W;
        const i = Math.round(((rel - PAD_L) / (W - PAD_L - PAD_R)) * (geom.pts.length - 1));
        setHover(Math.max(0, Math.min(geom.pts.length - 1, i)));
    };

    const up = (h?.change ?? 0) >= 0;
    const lineColor = up ? 'var(--green)' : 'var(--red)';
    const active = hover != null && geom ? geom.pts[hover] : null;
    const last = geom ? geom.pts[geom.pts.length - 1] : null;

    return (
        <div className="card" style={{ marginTop: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                    <h3 style={{ margin: 0 }}>Account equity</h3>
                    <div className="sub">Marked daily, including open positions — the growth curve a closed-trade list cannot show.</div>
                </div>
                <div className="row" style={{ gap: 4 }}>
                    {RANGES.map(r => <button key={r.label} className={`chip-btn ghost ${days === r.days ? 'active' : ''}`} onClick={() => setDays(r.days)}>{r.label}</button>)}
                </div>
            </div>

            {hist.loading && !h ? <div style={{ marginTop: 14 }}><Spinner dark /></div>
                : !h ? <Empty title="No history yet" text={hist.error || undefined} />
                : (
                    <>
                        <div className="stats" style={{ marginTop: 14, marginBottom: 0 }}>
                            <div className="stat"><span>Equity now</span><b>{money(h.endEquity)}</b></div>
                            <div className="stat"><span>Change over period</span><b className={pnlClass(h.change)}>{signed(h.change)}{h.changePct != null && <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}> ({pct(h.changePct)})</span>}</b></div>
                            <div className="stat"><span>Peak equity</span><b>{money(h.peakEquity)}</b></div>
                            <div className="stat"><span>Max drawdown</span><b className="down">−{money(h.maxDrawdown).replace('$', '$')}<span className="muted" style={{ fontSize: 13, fontWeight: 500 }}> ({h.maxDrawdownPct.toFixed(1)}%)</span></b></div>
                            <div className="stat"><span>Realised</span><b className={pnlClass(h.realised)}>{signed(h.realised)}</b></div>
                            <div className="stat"><span>Trades</span><b>{h.trades}<span className="muted" style={{ fontSize: 13, fontWeight: 500 }}> on {h.tradingDays} days</span></b></div>
                        </div>

                        {!geom ? (
                            <div className="note" style={{ marginTop: 14 }}>
                                {h.sparse
                                    ? 'The daily snapshot has not run yet on this account. The curve fills in from tomorrow; today is already marked.'
                                    : 'One day of history so far — the curve needs a second day to draw.'}
                            </div>
                        ) : (
                            <div className="chart-wrap" style={{ marginTop: 14 }} onMouseLeave={() => setHover(null)}>
                                <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="eq-svg" preserveAspectRatio="none" onMouseMove={onMove}>
                                    <defs>
                                        <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
                                            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    {[0, 0.25, 0.5, 0.75, 1].map(f => {
                                        const v = geom.min + f * (geom.max - geom.min);
                                        return (
                                            <g key={f}>
                                                <line x1={PAD_L} x2={W - PAD_R} y1={geom.y(v)} y2={geom.y(v)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                                                <text x={W - PAD_R + 6} y={geom.y(v) + 3.5} className="eq-tick">{money(v, 0)}</text>
                                            </g>
                                        );
                                    })}
                                    <path d={`${geom.pts.map((p, i) => `${i ? 'L' : 'M'}${geom.x(i)},${geom.y(p.equity)}`).join(' ')} L${geom.x(geom.pts.length - 1)},${H - PAD_B} L${geom.x(0)},${H - PAD_B} Z`} fill="url(#eqFill)" />
                                    <path d={geom.pts.map((p, i) => `${i ? 'L' : 'M'}${geom.x(i)},${geom.y(p.equity)}`).join(' ')} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                                    {last && <circle cx={geom.x(geom.pts.length - 1)} cy={geom.y(last.equity)} r="3.5" fill={lineColor} />}
                                    {active && (
                                        <g>
                                            <line x1={geom.x(hover!)} x2={geom.x(hover!)} y1={PAD_T} y2={H - PAD_B} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                                            <circle cx={geom.x(hover!)} cy={geom.y(active.equity)} r="4" fill={lineColor} stroke="var(--bg)" strokeWidth="2" />
                                        </g>
                                    )}
                                </svg>
                                <svg viewBox={`0 0 ${W} ${DD_H}`} className="eq-svg dd" preserveAspectRatio="none" onMouseMove={onMove}>
                                    <path d={`M${geom.x(0)},4 ${geom.pts.map((p, i) => `L${geom.x(i)},${geom.ddY(p.drawdownPct)}`).join(' ')} L${geom.x(geom.pts.length - 1)},4 Z`} fill="var(--red)" fillOpacity="0.22" />
                                    <path d={geom.pts.map((p, i) => `${i ? 'L' : 'M'}${geom.x(i)},${geom.ddY(p.drawdownPct)}`).join(' ')} fill="none" stroke="var(--red)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                                    <text x={W - PAD_R + 6} y={geom.ddY(geom.maxDd) + 3.5} className="eq-tick">−{geom.maxDd.toFixed(1)}%</text>
                                    {active && <line x1={geom.x(hover!)} x2={geom.x(hover!)} y1={0} y2={DD_H} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
                                </svg>
                                <div className="eq-axis">
                                    <span>{shortDay(geom.pts[0].day)}</span>
                                    <span className="muted small">Drawdown from peak</span>
                                    <span>{shortDay(geom.pts[geom.pts.length - 1].day)}</span>
                                </div>
                                {active && (
                                    <div className="eq-tip" style={{ left: `${Math.max(12, Math.min(84, (geom.x(hover!) / W) * 100))}%` }}>
                                        <b>{shortDay(active.day)}</b>
                                        <div><span>Equity</span><b>{money(active.equity)}</b></div>
                                        <div><span>Balance</span><b>{money(active.balance)}</b></div>
                                        <div><span>Day</span><b className={pnlClass(active.change)}>{signed(active.change)}</b></div>
                                        <div><span>From peak</span><b className={active.drawdown > 0 ? 'down' : ''}>{active.drawdown > 0 ? `−${money(active.drawdown)} (${active.drawdownPct.toFixed(1)}%)` : 'at the high'}</b></div>
                                        {active.trades > 0 && <div><span>Closed</span><b>{active.trades} · {signed(active.realised)}</b></div>}
                                    </div>
                                )}
                            </div>
                        )}

                        {h.months.length > 0 && (
                            <>
                                <div className="section-title" style={{ paddingLeft: 0 }}>Monthly returns</div>
                                <table className="grid">
                                    <thead><tr><th>Month</th><th className="r">Opened</th><th className="r">Closed</th><th className="r">Change</th><th></th><th className="r">Realised</th><th className="r">Trades</th></tr></thead>
                                    <tbody>
                                        {[...h.months].reverse().map(m => {
                                            const width = Math.min(100, Math.abs(m.changePct ?? 0) * 4);
                                            return (
                                                <tr key={m.month}>
                                                    <td className="strong">{monthLabel(m.month)}</td>
                                                    <td className="r muted">{money(m.startEquity)}</td>
                                                    <td className="r">{money(m.endEquity)}</td>
                                                    <td className={`r strong ${pnlClass(m.change)}`}>{signed(m.change)}{m.changePct != null && <span className="muted" style={{ fontWeight: 400 }}> {pct(m.changePct)}</span>}</td>
                                                    <td style={{ width: 120 }}>
                                                        <span className="mbar">{m.change >= 0
                                                            ? <i className="pos" style={{ width: `${width / 2}%` }} />
                                                            : <i className="neg" style={{ width: `${width / 2}%` }} />}</span>
                                                    </td>
                                                    <td className={`r ${pnlClass(m.realised)}`}>{signed(m.realised)}</td>
                                                    <td className="r muted">{m.trades}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </>
                )}
        </div>
    );
}
