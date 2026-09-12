/**
 * The trading journal: a month heatmap of closed trades, a day view with
 * the auto-written entry for every trade, and the trader's own note.
 */
import { useEffect, useState } from 'react';
import { api, data, q } from '../api';
import { Empty, Spinner, money, pnlClass, signed, useLoader, useToast, when } from '../components/ui';
import { fmtPrice } from '../symbols';

type Day = { day: string; label: string; trades: number; wins: number; netProfit: number; clean: boolean; riskTags: string[]; intensity: number };
type Month = {
    year: number; month: number; monthLabel: string; weekdayLabels: string[]; firstWeekday: number; days: Day[];
    totals: { trades: number; wins: number; winRate: number; netProfit: number; tradingDays: number; greenDays: number; redDays: number; cleanDays: number; bestDay: any; worstDay: any };
    prev: { year: number; month: number }; next: { year: number; month: number }; today: string; streak?: any;
};

const tz = -new Date().getTimezoneOffset();

export function JournalPage() {
    const [ym, setYm] = useState<{ year?: number; month?: number }>({});
    const [source, setSource] = useState<'manual' | 'bot' | 'all'>('manual');
    const [day, setDay] = useState<string | null>(null);
    const month = useLoader<Month>(() => data(q('/journal/month', { calendar: 'gregorian', year: ym.year, month: ym.month, tz, source })), [ym.year, ym.month, source]);
    const m = month.data;

    useEffect(() => { if (m && !day) setDay(m.today); }, [m, day]);

    const cellClass = (d: Day) => {
        if (!d.trades) return '';
        const lvl = d.intensity >= 0.66 ? 3 : d.intensity >= 0.33 ? 2 : 1;
        return d.netProfit >= 0 ? `g${lvl}` : `r${lvl}`;
    };

    return (
        <div className="page"><div className="page-inner">
            <div className="page-head">
                <div><h1>Journal</h1><p>Every closed trade is written up automatically. Add your own note to remember why.</p></div>
                <div className="seg ticket" style={{ padding: 0, flexDirection: 'row', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
                    {(['manual', 'bot', 'all'] as const).map(s => <button key={s} className={`tb-btn ${source === s ? 'active' : ''}`} style={{ borderRadius: 0 }} onClick={() => setSource(s)}>{s === 'manual' ? 'My trades' : s === 'bot' ? 'Bot trades' : 'All'}</button>)}
                </div>
            </div>
            {month.loading && !m ? <Spinner dark /> : !m ? <Empty title="Journal unavailable" text={month.error || undefined} /> : (
                <div className="two" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
                    <div>
                        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                            <button className="btn ghost sm" onClick={() => setYm(m.prev)}>‹ Prev</button>
                            <b style={{ fontSize: 15 }}>{m.monthLabel}</b>
                            <button className="btn ghost sm" onClick={() => setYm(m.next)}>Next ›</button>
                        </div>
                        <div className="cal">
                            {m.weekdayLabels.map(w => <div key={w} className="wd">{w}</div>)}
                            {Array.from({ length: m.firstWeekday }).map((_, i) => <div key={`p${i}`} className="d pad" />)}
                            {m.days.map(d => (
                                <div key={d.day} className={`d ${cellClass(d)} ${day === d.day ? 'sel' : ''}`} onClick={() => setDay(d.day)} title={d.trades ? `${d.trades} trades · ${signed(d.netProfit)}` : ''}>
                                    <span className="n">{d.label}</span>
                                    {d.trades > 0 && <span className={`p ${pnlClass(d.netProfit)}`}>{signed(d.netProfit, 0)}</span>}
                                </div>
                            ))}
                        </div>
                        <div className="stats" style={{ marginTop: 16 }}>
                            <div className="stat"><span>Trades</span><b>{m.totals.trades}</b></div>
                            <div className="stat"><span>Win rate</span><b>{m.totals.winRate}%</b></div>
                            <div className="stat"><span>Net</span><b className={pnlClass(m.totals.netProfit)}>{signed(m.totals.netProfit)}</b></div>
                            <div className="stat"><span>Green / red days</span><b><span className="up">{m.totals.greenDays}</span> / <span className="down">{m.totals.redDays}</span></b></div>
                            <div className="stat"><span>Clean days</span><b>{m.totals.cleanDays}</b></div>
                        </div>
                    </div>
                    <div>{day && <DayView day={day} source={source} />}</div>
                </div>
            )}
        </div></div>
    );
}

function DayView({ day, source }: { day: string; source: string }) {
    const toast = useToast();
    const d = useLoader<any>(() => data(q('/journal/day', { date: day, tz, source })), [day, source]);
    const [note, setNote] = useState('');
    const [emotion, setEmotion] = useState('');
    const [saving, setSaving] = useState<string | null>(null);
    const v = d.data;
    const trades: any[] = v?.trades ?? [];

    const saveNote = async (positionId: string) => {
        setSaving(positionId);
        try {
            await api(`/journal/note/${positionId}`, { method: 'POST', body: { note, emotion: emotion || undefined } });
            toast('Note saved', 'ok'); setNote(''); d.reload();
        } catch (e: any) { toast(e.message, 'err'); } finally { setSaving(null); }
    };

    return (
        <div className="card" style={{ minHeight: 300 }}>
            <h3>{new Date(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            {d.loading && !v ? <Spinner dark /> : trades.length === 0 ? <div className="muted">No closed trades on this day.</div> : (
                <>
                    {v.recap && <div className="note" style={{ marginBottom: 12, color: 'var(--text)' }}>{typeof v.recap === 'string' ? v.recap : v.recap.en ?? ''}</div>}
                    {trades.map(t => (
                        <div key={t.id} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
                            <div className="row" style={{ justifyContent: 'space-between' }}>
                                <span><span className={`side ${t.side}`}>{t.side}</span> <b>{t.symbol}</b> <span className="muted">{t.volume} lots</span></span>
                                <b className={pnlClass(t.netProfit)}>{signed(t.netProfit)}</b>
                            </div>
                            <div className="muted small" style={{ marginTop: 4 }}>{fmtPrice(t.symbol, t.entryPrice)} → {fmtPrice(t.symbol, t.closePrice)} · {when(t.openTime)} → {when(t.closeTime)}{t.pips != null ? ` · ${t.pips > 0 ? '+' : ''}${Number(t.pips).toFixed(1)} pips` : ''}</div>
                            {!!t.tags?.length && <div className="row" style={{ gap: 4, marginTop: 6, flexWrap: 'wrap' }}>{t.tags.map((g: string) => <span key={g} className="chip">{g}</span>)}</div>}
                            {t.entry && <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.5 }}>{typeof t.entry === 'string' ? t.entry : t.entry.en ?? ''}</p>}
                            {t.note?.note ? <div className="note" style={{ marginTop: 8, color: 'var(--text)' }}><b className="muted small">Your note{t.note.emotion ? ` · ${t.note.emotion}` : ''}</b><div>{t.note.note}</div></div> : (
                                <div className="row" style={{ marginTop: 8, gap: 6 }}>
                                    <input className="box grow" placeholder="Why did you take it? How did it feel?" value={saving === null ? note : ''} onChange={e => setNote(e.target.value)} style={{ height: 30 }} />
                                    <select className="box" value={emotion} onChange={e => setEmotion(e.target.value)} style={{ height: 30 }}><option value="">Mood</option><option>calm</option><option>confident</option><option>anxious</option><option>frustrated</option><option>greedy</option><option>bored</option></select>
                                    <button className="btn ghost sm" disabled={!note.trim() || saving === t.id} onClick={() => saveNote(t.id)}>Save</button>
                                </div>
                            )}
                        </div>
                    ))}
                    <div className="row muted small" style={{ justifyContent: 'space-between', marginTop: 8 }}><span>{trades.length} trades</span><span>Day net {money(trades.reduce((s, t) => s + (t.netProfit || 0), 0))}</span></div>
                </>
            )}
        </div>
    );
}
