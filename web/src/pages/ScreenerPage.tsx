/**
 * The screener: every instrument on one table, filtered by the numbers a
 * trader actually screens on. The server computes the table on a timer
 * from real hourly bars; this page only filters and sorts it.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { data } from '../api';
import { Empty, Spinner, ago, useLoader, useStored } from '../components/ui';
import { useQuotes } from '../market';
import { CLASSES, fmtPrice, infoOf, type AssetClass } from '../symbols';

interface Row { symbol: string; last: number; change24hPct: number | null; rsi14: number | null; ema20: number | null; ema50: number | null; trend: 'up' | 'down' | 'flat'; atrPct: number | null; volumeRatio: number | null; high20: number; low20: number; rangePos: number | null; bars: number; updatedAt: number }
interface Sent { symbol: string; longs: number; shorts: number; traders: number; longPct: number | null }

type Preset = 'all' | 'gainers' | 'losers' | 'oversold' | 'overbought' | 'uptrend' | 'downtrend' | 'breakout' | 'volume' | 'crowded';
const PRESETS: Array<{ id: Preset; label: string; hint: string }> = [
    { id: 'all', label: 'All', hint: 'Every instrument with data' },
    { id: 'gainers', label: 'Top gainers', hint: '24h change, best first' },
    { id: 'losers', label: 'Top losers', hint: '24h change, worst first' },
    { id: 'oversold', label: 'RSI < 30', hint: 'Oversold on the hourly' },
    { id: 'overbought', label: 'RSI > 70', hint: 'Overbought on the hourly' },
    { id: 'uptrend', label: 'Uptrend', hint: 'Price above EMA20 above EMA50' },
    { id: 'downtrend', label: 'Downtrend', hint: 'Price below EMA20 below EMA50' },
    { id: 'breakout', label: 'Near 20-bar high', hint: 'Within 1% of the 20-bar high' },
    { id: 'volume', label: 'Volume spike', hint: 'Last bar volume ≥ 2× the 20-bar average' },
    { id: 'crowded', label: 'Crowded trades', hint: '≥ 75% of Termax traders on one side' },
];
type SortKey = 'symbol' | 'last' | 'change24hPct' | 'rsi14' | 'atrPct' | 'volumeRatio' | 'rangePos' | 'longPct';

export function ScreenerPage() {
    const nav = useNavigate();
    const table = useLoader<{ rows: Row[]; updatedAt: number; refreshing: boolean }>(() => data('/market/screener'), [], { every: 60_000 });
    const sent = useLoader<Sent[]>(() => data('/market/sentiment'), [], { every: 60_000 });
    const [preset, setPreset] = useStored<Preset>('tx.scr.preset', 'all');
    const [cls, setCls] = useStored<AssetClass | 'All'>('tx.scr.cls', 'All');
    const [sort, setSort] = useStored<{ key: SortKey; dir: 1 | -1 }>('tx.scr.sort', { key: 'change24hPct', dir: -1 });
    const [q, setQ] = useState('');
    const sentBy = useMemo(() => new Map((sent.data ?? []).map(s => [s.symbol, s])), [sent.data]);

    const rows = useMemo(() => {
        let list = (table.data?.rows ?? []).map(r => ({ ...r, longPct: sentBy.get(r.symbol)?.longPct ?? null, traders: sentBy.get(r.symbol)?.traders ?? 0 }));
        if (cls !== 'All') list = list.filter(r => infoOf(r.symbol).cls === cls);
        if (q.trim()) { const n = q.trim().toUpperCase().replace(/\s+/g, ''); list = list.filter(r => r.symbol.replace('/', '').includes(n) || infoOf(r.symbol).name.toUpperCase().replace(/\s+/g, '').includes(n)); }
        switch (preset) {
            case 'gainers': list = list.filter(r => (r.change24hPct ?? 0) > 0); break;
            case 'losers': list = list.filter(r => (r.change24hPct ?? 0) < 0); break;
            case 'oversold': list = list.filter(r => r.rsi14 != null && r.rsi14 < 30); break;
            case 'overbought': list = list.filter(r => r.rsi14 != null && r.rsi14 > 70); break;
            case 'uptrend': list = list.filter(r => r.trend === 'up'); break;
            case 'downtrend': list = list.filter(r => r.trend === 'down'); break;
            case 'breakout': list = list.filter(r => r.high20 > 0 && (r.high20 - r.last) / r.high20 < 0.01); break;
            case 'volume': list = list.filter(r => (r.volumeRatio ?? 0) >= 2); break;
            case 'crowded': list = list.filter(r => r.traders >= 2 && r.longPct != null && (r.longPct >= 75 || r.longPct <= 25)); break;
        }
        const dir = preset === 'losers' ? 1 : preset === 'gainers' ? -1 : sort.dir;
        const key: SortKey = preset === 'losers' || preset === 'gainers' ? 'change24hPct' : sort.key;
        return [...list].sort((a: any, b: any) => {
            const av = a[key], bv = b[key];
            if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1;
            return typeof av === 'string' ? av.localeCompare(bv) * dir : (av - bv) * dir;
        });
    }, [table.data, sentBy, cls, q, preset, sort]);

    const live = useQuotes(useMemo(() => rows.slice(0, 60).map(r => r.symbol), [rows]));
    const head = (key: SortKey, label: string, right = true) => (
        <th className={right ? 'r' : ''} style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}>
            {label}{sort.key === key ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
        </th>
    );
    const open = (s: string) => nav(`/chart/${encodeURIComponent(s.replace('/', '-'))}`);

    return (
        <div className="page"><div className="page-inner" style={{ maxWidth: 1400 }}>
            <div className="page-head">
                <div><h1>Screener</h1><p>Every market, ranked by what matters right now. Hourly bars, recomputed every ten minutes{table.data?.updatedAt ? ` · updated ${ago(table.data.updatedAt)}` : ''}.</p></div>
                <input className="box" placeholder="Filter symbol…" value={q} onChange={e => setQ(e.target.value)} style={{ width: 220 }} />
            </div>
            <div className="toolbar-row" style={{ gap: 6 }}>
                {PRESETS.map(p => <button key={p.id} className={`chip-btn ${preset === p.id ? 'active' : ''}`} title={p.hint} onClick={() => setPreset(p.id)}>{p.label}</button>)}
                <span className="grow" />
                {(['All', ...CLASSES] as const).map(c => <button key={c} className={`chip-btn ghost ${cls === c ? 'active' : ''}`} onClick={() => setCls(c)}>{c}</button>)}
            </div>
            {table.loading && !table.data ? <Spinner dark /> : !table.data?.rows.length ? (
                <Empty title={table.data?.refreshing ? 'Building the table…' : 'No data yet'} text={table.error || 'The server computes the screener a minute after start-up; refresh shortly.'} />
            ) : rows.length === 0 ? <Empty title="Nothing matches" text="Loosen the preset or the market filter." /> : (
                <div style={{ overflowX: 'auto' }}>
                    <table className="grid">
                        <thead><tr>
                            {head('symbol', 'Symbol', false)}<th>Market</th>{head('last', 'Last')}{head('change24hPct', '24h %')}{head('rsi14', 'RSI 14')}<th>Trend</th>{head('atrPct', 'ATR %')}{head('volumeRatio', 'Vol ×')}{head('rangePos', '20-bar range')}{head('longPct', 'Traders long')}<th></th>
                        </tr></thead>
                        <tbody>
                            {rows.map(r => {
                                const lq = live[r.symbol]?.price ?? r.last;
                                const s = sentBy.get(r.symbol);
                                return (
                                    <tr key={r.symbol} style={{ cursor: 'pointer' }} onClick={() => open(r.symbol)}>
                                        <td className="strong">{r.symbol}<div className="muted small" style={{ fontWeight: 400 }}>{infoOf(r.symbol).name}</div></td>
                                        <td className="muted">{infoOf(r.symbol).cls}</td>
                                        <td className="r num">{fmtPrice(r.symbol, lq)}</td>
                                        <td className={`r strong ${r.change24hPct == null ? '' : r.change24hPct >= 0 ? 'up' : 'down'}`}>{r.change24hPct == null ? '—' : `${r.change24hPct >= 0 ? '+' : ''}${r.change24hPct.toFixed(2)}%`}</td>
                                        <td className={`r ${r.rsi14 == null ? '' : r.rsi14 > 70 ? 'down' : r.rsi14 < 30 ? 'up' : ''}`}><span className="row" style={{ justifyContent: 'flex-end', gap: 6 }}><span className="bar" style={{ width: 54 }}><i style={{ width: `${r.rsi14 ?? 0}%`, background: r.rsi14 == null ? 'var(--muted-2)' : r.rsi14 > 70 ? 'var(--red)' : r.rsi14 < 30 ? 'var(--green)' : 'var(--blue)' }} /></span>{r.rsi14?.toFixed(0) ?? '—'}</span></td>
                                        <td><span className={`chip ${r.trend === 'up' ? 'green' : r.trend === 'down' ? 'red' : ''}`}>{r.trend === 'up' ? 'Up' : r.trend === 'down' ? 'Down' : 'Flat'}</span></td>
                                        <td className="r">{r.atrPct?.toFixed(2) ?? '—'}</td>
                                        <td className={`r ${(r.volumeRatio ?? 0) >= 2 ? 'strong' : 'muted'}`}>{r.volumeRatio?.toFixed(1) ?? '—'}</td>
                                        <td className="r"><span className="row" style={{ justifyContent: 'flex-end', gap: 6 }}><span className="range"><i style={{ left: `${Math.max(0, Math.min(100, r.rangePos ?? 50))}%` }} /></span>{r.rangePos?.toFixed(0) ?? '—'}%</span></td>
                                        <td className="r">{s && s.traders > 0 && s.longPct != null ? <span className="row" style={{ justifyContent: 'flex-end', gap: 6 }}><span className="sent"><i style={{ width: `${s.longPct}%` }} /></span><span className={s.longPct >= 50 ? 'up' : 'down'}>{s.longPct}%</span><span className="muted small">({s.traders})</span></span> : <span className="muted">—</span>}</td>
                                        <td className="r"><button className="link-btn" onClick={e => { e.stopPropagation(); open(r.symbol); }}>Chart</button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div></div>
    );
}
