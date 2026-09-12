import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { data } from '../api';
import { Empty, Spinner, useLoader, when } from '../components/ui';
import { fmtPrice } from '../symbols';

type Heat = { symbol: string; name: string; change24h: number; price: number };
type Analysis = { id: number; symbol: string; rsi: number; macdSignal: string; [k: string]: any };
type Event = { event: string; country: string; impact: string; time: string; timestamp: number; actual?: string; forecast?: string; previous?: string };

const heatColor = (chg: number) => {
    const a = Math.min(1, Math.abs(chg) / 6);
    return chg >= 0 ? `rgba(8,153,129,${0.25 + a * 0.6})` : `rgba(242,54,69,${0.25 + a * 0.6})`;
};

export function MarketsPage() {
    const nav = useNavigate();
    const [tab, setTab] = useState<'heat' | 'analysis' | 'calendar'>('heat');
    const heat = useLoader<Heat[]>(() => data('/tools/heatmap'), [], { every: 60_000 });
    const analysis = useLoader<Analysis[]>(() => data('/tools/analysis'), []);
    const calendar = useLoader<Event[]>(() => data('/tools/calendar'), []);
    const open = (s: string) => nav(`/chart/${encodeURIComponent(s.replace('/', '-'))}`);

    return (
        <div className="page"><div className="page-inner">
            <div className="page-head"><div><h1>Markets</h1><p>Where the money is moving today — click any tile to open its chart.</p></div></div>
            <div className="tabs" style={{ marginBottom: 16, borderBottom: '1px solid var(--line)' }}>
                <button className={tab === 'heat' ? 'active' : ''} onClick={() => setTab('heat')}>Heatmap</button>
                <button className={tab === 'analysis' ? 'active' : ''} onClick={() => setTab('analysis')}>Technical scan</button>
                <button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}>Economic calendar</button>
            </div>
            {tab === 'heat' && (heat.loading ? <Spinner dark /> : !heat.data?.length ? <Empty title="Heatmap unavailable" text={heat.error || 'The market data provider did not answer.'} /> : (
                <div className="heat">
                    {[...heat.data].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).map(h => (
                        <div key={h.symbol} className="t" style={{ background: heatColor(h.change24h) }} onClick={() => open(h.symbol)}>
                            <b>{h.name}</b>
                            <div><span>{fmtPrice(h.symbol, h.price)}</span><br /><span style={{ fontWeight: 700 }}>{h.change24h >= 0 ? '+' : ''}{h.change24h.toFixed(2)}%</span></div>
                        </div>
                    ))}
                </div>
            ))}
            {tab === 'analysis' && (analysis.loading ? <Spinner dark /> : !analysis.data?.length ? <Empty title="No scan available" text={analysis.error || undefined} /> : (
                <table className="grid">
                    <thead><tr><th>Symbol</th><th className="r">RSI (14)</th><th>Momentum</th><th>MACD</th><th>Bias</th><th></th></tr></thead>
                    <tbody>
                        {analysis.data.map(a => {
                            const bias = a.rsi > 60 ? 'Bullish' : a.rsi < 40 ? 'Bearish' : 'Neutral';
                            return (
                                <tr key={a.id}>
                                    <td className="strong">{a.symbol}</td>
                                    <td className={`r ${a.rsi > 70 ? 'down' : a.rsi < 30 ? 'up' : ''}`}>{a.rsi}</td>
                                    <td><div className="bar" style={{ width: 120 }}><i style={{ width: `${a.rsi}%`, background: a.rsi > 50 ? 'var(--green)' : 'var(--red)' }} /></div></td>
                                    <td>{a.macdSignal}</td>
                                    <td><span className={`chip ${bias === 'Bullish' ? 'green' : bias === 'Bearish' ? 'red' : ''}`}>{bias}</span></td>
                                    <td className="r"><button className="link-btn" onClick={() => open(a.symbol)}>Open chart</button></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            ))}
            {tab === 'calendar' && (calendar.loading ? <Spinner dark /> : !calendar.data?.length ? <Empty title="No upcoming events" text={calendar.error || undefined} /> : (
                <table className="grid">
                    <thead><tr><th>Time</th><th>Currency</th><th>Event</th><th>Impact</th><th className="r">Actual</th><th className="r">Forecast</th><th className="r">Previous</th></tr></thead>
                    <tbody>
                        {calendar.data.slice(0, 120).map((e, i) => (
                            <tr key={i}>
                                <td className="muted">{when(e.time)}</td>
                                <td className="strong">{e.country}</td>
                                <td>{e.event}</td>
                                <td><span className={`chip ${e.impact === 'HIGH' ? 'red' : e.impact === 'MEDIUM' ? 'amber' : ''}`}>{e.impact}</span></td>
                                <td className="r">{e.actual || '—'}</td><td className="r">{e.forecast || '—'}</td><td className="r muted">{e.previous || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ))}
        </div></div>
    );
}
