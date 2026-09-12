/**
 * Replay: the market one candle at a time, the trader's paper score in pips
 * against the bot playing the same window through the real engine, and in
 * learn mode the bot's reasoning for the bar just revealed — rendered by
 * the interpreter's own trace, so what is read cannot drift from what ran.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dispose, init, type Chart as KChart } from 'klinecharts';
import { useSearchParams } from 'react-router-dom';
import { data } from '../api';
import { Ic } from '../components/icons';
import { Spinner } from '../components/ui';
import { TIMEFRAMES, type Timeframe } from '../market';
import { digitsFor, fmtPrice, search } from '../symbols';
import { ensureBotOverlay } from '../terminal/botOverlay';

interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number }
interface BotTrade { side: 'BUY' | 'SELL'; entryTime: number; entryPrice: number; exitTime: number; exitPrice: number; pips: number; exitReason: string }
interface Lesson { time: number; outcome: string; inPosition: boolean; blockedBy: string | null; headline: string; title: string; lines: Array<{ depth: number; text: string; passed: boolean; group: boolean }> }
interface Session { symbol: string; timeframe: Timeframe; botName: string | null; warmup: number; candles: Candle[]; botTrades: BotTrade[]; botTotalPips: number; learn: boolean; lessons: Lesson[] }

const pipSizeOf = (symbol: string) => symbol.includes('JPY') ? 0.01 : symbol.includes('/USDT') || ['GOLD', 'SPX', 'NDQ', 'DJI', 'DAX'].some(s => symbol.includes(s)) ? 0.1 : symbol.includes('/') ? 0.0001 : 0.01;
const SPEEDS = [1000, 500, 250, 100];
const STYLES = { grid: { horizontal: { color: 'rgba(255,255,255,0.05)' }, vertical: { color: 'rgba(255,255,255,0.05)' } }, candle: { bar: { upColor: '#089981', downColor: '#f23645', upBorderColor: '#089981', downBorderColor: '#f23645', upWickColor: '#089981', downWickColor: '#f23645' }, tooltip: { showRule: 'none' }, priceMark: { last: { upColor: '#089981', downColor: '#f23645' } } }, xAxis: { tickText: { color: '#787b86', size: 11 } }, yAxis: { tickText: { color: '#787b86', size: 11 } }, crosshair: { horizontal: { text: { backgroundColor: '#363a45' } }, vertical: { text: { backgroundColor: '#363a45' } } } } as any;

export function ReplayPage() {
    const [params, setParams] = useSearchParams();
    const symbol = (params.get('symbol') || 'BTC/USDT').toUpperCase();
    const timeframe = (TIMEFRAMES.includes(params.get('tf') as Timeframe) ? params.get('tf') : '15m') as Timeframe;
    const botId = params.get('bot') || '';
    const [bots, setBots] = useState<Array<{ id: string; name: string; spec: { symbol: string; timeframe: string } }>>([]);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cursor, setCursor] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [position, setPosition] = useState<{ side: 'BUY' | 'SELL'; entry: number } | null>(null);
    const [myPips, setMyPips] = useState(0);
    const [myTrades, setMyTrades] = useState(0);
    const [learnOpen, setLearnOpen] = useState(true);
    const [pickSym, setPickSym] = useState('');
    const host = useRef<HTMLDivElement>(null);
    const chart = useRef<KChart | null>(null);
    const drawn = useRef<Set<number>>(new Set());

    useEffect(() => { data<any[]>('/bots').then(setBots).catch(() => undefined); }, []);

    // Mount the chart once.
    useEffect(() => {
        if (!host.current) return;
        const c = init(host.current, { styles: STYLES, locale: 'en-US' });
        if (!c) return;
        chart.current = c;
        c.setOffsetRightDistance(60);
        ensureBotOverlay();
        const ro = new ResizeObserver(() => c.resize());
        ro.observe(host.current);
        return () => { ro.disconnect(); if (host.current) dispose(host.current); chart.current = null; };
    }, []);

    const load = useCallback(async () => {
        setLoading(true); setError(null); setSession(null); setPosition(null); setMyPips(0); setMyTrades(0); setPlaying(false);
        drawn.current.clear();
        try {
            const d = await data<Session>('/replay', { method: 'POST', body: { symbol, timeframe, botId: botId || undefined, days: 30, learn: true } });
            setSession(d);
            setCursor(d.warmup);
            const c = chart.current;
            if (c) {
                c.removeOverlay();
                c.applyNewData(d.candles.slice(0, d.warmup).map(b => ({ timestamp: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume })));
                c.setPriceVolumePrecision(digitsFor(d.symbol, d.candles[d.candles.length - 1]?.close), 0);
            }
        } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    }, [symbol, timeframe, botId]);
    useEffect(() => { load(); }, [load]);

    const pipSize = pipSizeOf(symbol);
    const current = session?.candles[cursor - 1];
    const finished = !!session && cursor >= session.candles.length;
    const openPips = position && current ? Number((((position.side === 'BUY' ? current.close - position.entry : position.entry - current.close)) / pipSize).toFixed(1)) : null;
    const botRevealed = useMemo(() => {
        if (!session || !current) return 0;
        return Number(session.botTrades.filter(t => t.exitTime <= current.time).reduce((s, t) => s + t.pips, 0).toFixed(1));
    }, [session, current]);
    const lesson = useMemo(() => (session && current ? session.lessons.find(l => l.time === current.time) ?? null : null), [session, current]);

    const step = useCallback(() => {
        if (!session || !chart.current) return;
        if (cursor >= session.candles.length) { setPlaying(false); return; }
        const c = session.candles[cursor];
        chart.current.updateData({ timestamp: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume });
        // Reveal the bot's trades as their exits pass.
        session.botTrades.forEach((t, i) => {
            if (t.exitTime <= c.time && !drawn.current.has(i)) {
                drawn.current.add(i);
                chart.current!.createOverlay({ id: `rp-bot-${i}`, name: 'botTrade', lock: true, groupId: 'bot', points: [{ timestamp: t.entryTime, value: t.entryPrice }, { timestamp: t.exitTime, value: t.exitPrice }], extendData: { side: t.side, netProfit: t.pips } } as any);
            }
        });
        setCursor(n => n + 1);
    }, [session, cursor]);

    useEffect(() => {
        if (!playing) return;
        const id = setInterval(step, SPEEDS[speed]);
        return () => clearInterval(id);
    }, [playing, step, speed]);

    const trade = (side: 'BUY' | 'SELL') => {
        if (!current) return;
        if (position) {
            const pips = Number((((position.side === 'BUY' ? current.close - position.entry : position.entry - current.close)) / pipSize).toFixed(1));
            setMyPips(p => Number((p + pips).toFixed(1)));
            setMyTrades(n => n + 1);
            chart.current?.createOverlay({ name: 'botTrade', lock: true, groupId: 'me', points: [{ timestamp: position.entry === current.close ? current.time : current.time, value: position.entry }, { timestamp: current.time, value: current.close }], extendData: { side: position.side, netProfit: pips } } as any);
            setPosition(null);
            if (side === position.side) return; // "Close" clicked
        }
        if (side !== position?.side) setPosition({ side, entry: current.close });
    };
    const closePos = () => { if (position) trade(position.side); };

    useReplayKeys(step);

    const setParam = (k: string, v: string) => { const next = new URLSearchParams(params); if (v) next.set(k, v); else next.delete(k); setParams(next, { replace: true }); };
    const symHits = pickSym.trim() ? search(pickSym).slice(0, 6) : [];

    return (
        <div className="page" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="replay">
                <div className="replay-top">
                    <div className="rel">
                        <input className="box" placeholder={symbol} value={pickSym} onChange={e => setPickSym(e.target.value)} style={{ width: 180 }} onKeyDown={e => { if (e.key === 'Enter' && symHits[0]) { setParam('symbol', symHits[0].symbol); setPickSym(''); } }} />
                        {symHits.length > 0 && <div className="drop" style={{ minWidth: 220 }}>{symHits.map(h => <button key={h.symbol} onClick={() => { setParam('symbol', h.symbol); setParam('bot', ''); setPickSym(''); }}>{h.symbol}<span className="muted small">{h.name}</span></button>)}</div>}
                    </div>
                    <div className="tb-tf">{TIMEFRAMES.filter(t => t !== '1w').map(tf => <button key={tf} className={`tb-btn ${tf === timeframe ? 'active' : ''}`} onClick={() => setParam('tf', tf)}>{tf.toUpperCase()}</button>)}</div>
                    <select className="box" value={botId} onChange={e => setParam('bot', e.target.value)} title="Play against a bot">
                        <option value="">No bot — just practise</option>
                        {bots.map(b => <option key={b.id} value={b.id}>{b.name} · {b.spec.symbol} {b.spec.timeframe}</option>)}
                    </select>
                    <span className="grow" />
                    <button className="btn ghost sm" onClick={load} disabled={loading}>Restart</button>
                </div>
                <div className="replay-body">
                    <div className="replay-chart">
                        <div ref={host} className="kline" />
                        {loading && <div className="chart-empty"><span className="row"><Spinner dark /> Loading {symbol} {timeframe}…</span></div>}
                        {error && !loading && <div className="chart-empty block"><div className="note err" style={{ maxWidth: 420 }}>{error}</div></div>}
                        {session && current && (
                            <div className="replay-hud">
                                <b>{session.symbol}</b> <span className="muted">{session.timeframe.toUpperCase()}</span> · {new Date(current.time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · bar {cursor - session.warmup} / {session.candles.length - session.warmup}
                            </div>
                        )}
                        {finished && session && (
                            <div className="chart-empty block">
                                <div className="card" style={{ width: 360, textAlign: 'center' }}>
                                    <h3 style={{ fontSize: 18 }}>{session.botName ? (myPips > session.botTotalPips ? '🏆 You beat the bot' : myPips === session.botTotalPips ? '🤝 Dead heat' : '🤖 The bot wins') : '🏁 Replay finished'}</h3>
                                    <div className="muted">You: <b className={myPips >= 0 ? 'up' : 'down'}>{myPips >= 0 ? '+' : ''}{myPips} pips</b> in {myTrades} trades{session.botName ? <> · {session.botName}: <b className={session.botTotalPips >= 0 ? 'up' : 'down'}>{session.botTotalPips >= 0 ? '+' : ''}{session.botTotalPips} pips</b></> : null}</div>
                                    <button className="btn primary" style={{ marginTop: 14 }} onClick={load}>Replay again</button>
                                </div>
                            </div>
                        )}
                    </div>
                    <aside className="replay-side">
                        <div className="score">
                            <div><span className="muted small">YOU</span><b className={myPips >= 0 ? 'up' : 'down'}>{myPips >= 0 ? '+' : ''}{myPips} pips</b><span className="muted small">{myTrades} trades{openPips != null ? ` · open ${openPips >= 0 ? '+' : ''}${openPips}` : ''}</span></div>
                            <div><span className="muted small">{session?.botName ? session.botName.toUpperCase() : 'BOT'}</span><b className={botRevealed >= 0 ? 'up' : 'down'}>{botRevealed >= 0 ? '+' : ''}{botRevealed} pips</b><span className="muted small">{session?.botName ? 'revealed so far' : 'no bot selected'}</span></div>
                        </div>
                        <div className="replay-ctrls">
                            <button className="btn ghost" onClick={step} disabled={!session || finished} title="Next candle (→)"><span style={{ width: 18, height: 18, display: 'inline-flex' }}><Ic.chevron /></span> Step</button>
                            <button className={`btn ${playing ? 'ghost' : 'primary'}`} onClick={() => setPlaying(p => !p)} disabled={!session || finished}>{playing ? 'Pause' : 'Play'}</button>
                            <select className="box" value={speed} onChange={e => setSpeed(Number(e.target.value))} style={{ width: 80 }}>{SPEEDS.map((ms, i) => <option key={ms} value={i}>{[1, 2, 4, 10][i]}×</option>)}</select>
                        </div>
                        <div className="replay-trade">
                            <button className="btn buy" disabled={!current || finished || position?.side === 'BUY'} onClick={() => trade('BUY')}>Buy {current ? fmtPrice(symbol, current.close) : ''}</button>
                            <button className="btn sell" disabled={!current || finished || position?.side === 'SELL'} onClick={() => trade('SELL')}>Sell {current ? fmtPrice(symbol, current.close) : ''}</button>
                            <button className="btn ghost" disabled={!position} onClick={closePos}>Close{openPips != null ? ` (${openPips >= 0 ? '+' : ''}${openPips})` : ''}</button>
                        </div>
                        {position && <div className="note" style={{ margin: '0 12px' }}>Open {position.side} from {fmtPrice(symbol, position.entry)}. Buy/Sell the other way flips the position.</div>}
                        {session?.botName && (
                            <div className="lesson">
                                <button className="lesson-head" onClick={() => setLearnOpen(o => !o)}>
                                    <span className="chip blue">Learn</span>
                                    <span className="grow ellipsis">{lesson ? lesson.headline : 'No explanation for this candle'}</span>
                                    <span className="muted">{learnOpen ? '▾' : '▸'}</span>
                                </button>
                                {learnOpen && lesson && lesson.lines.length > 0 && (
                                    <div className="lesson-body">
                                        <div className="muted small" style={{ marginBottom: 4 }}>{lesson.title}</div>
                                        {lesson.lines.map((l, i) => (
                                            <div key={i} className={`lesson-line ${l.group ? 'group' : ''}`} style={{ paddingLeft: 4 + l.depth * 14 }}>
                                                <span className={l.passed ? 'up' : 'down'}>{l.group ? '▾' : l.passed ? '✓' : '✗'}</span>
                                                <span>{l.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {learnOpen && lesson && lesson.lines.length === 0 && <div className="lesson-body muted small">No condition was tested on this bar.</div>}
                            </div>
                        )}
                        {session && !session.botName && <div className="note" style={{ margin: '0 12px' }}>Pick one of your bots above to see its trades appear as the candles do — and its reasoning for every bar.</div>}
                        {!!session?.botTrades.length && (
                            <div className="section-title">Bot trades revealed</div>
                        )}
                        <div className="panel-body" style={{ padding: '0 12px' }}>
                            {session?.botTrades.filter(t => current && t.exitTime <= current.time).slice(-12).reverse().map((t, i) => (
                                <div key={i} className="row small" style={{ justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--line-soft)' }}>
                                    <span><span className={`side ${t.side}`}>{t.side}</span> {fmtPrice(symbol, t.entryPrice)} → {fmtPrice(symbol, t.exitPrice)}</span>
                                    <span className={t.pips >= 0 ? 'up' : 'down'}>{t.pips >= 0 ? '+' : ''}{t.pips} <span className="muted">{t.exitReason.toLowerCase().replace('_', ' ')}</span></span>
                                </div>
                            ))}
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}

export function useReplayKeys(step: () => void) {
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') step(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [step]);
}
