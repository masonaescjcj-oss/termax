/**
 * The trading terminal: toolbar, drawing rail, chart with its footer, the
 * right panel behind an icon rail, and the book. Layout state (panels,
 * timeframe, indicators, chart type, scale) persists per browser; the
 * watchlist persists on the account.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { refreshAllBooks, usePositions } from './account';
import type { PositionDraft } from './positionTool';
import { setTicketDraft } from './ticketDraft';
import { listIndicators, toggleIndicator as toggleIndicatorApi, type CustomIndicator } from './customIndicators';
import { IndicatorsManager } from './IndicatorsManager';
import type { BotChartData } from './botOverlay';
import { data } from '../api';
import type { KLineData } from 'klinecharts';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { accountIdOf, primaryAccount, useAuth } from '../auth';
import { Chat } from '../components/Chat';
import { Ic } from '../components/icons';
import { useStored, useToast } from '../components/ui';
import { changePct, useDayOpen } from '../daychange';
import { useQuote, type Timeframe } from '../market';
import { DEFAULT_WATCHLIST, digitsFor, fmtPrice, infoOf } from '../symbols';
import { AlertsPanel } from './AlertsPanel';
import { BottomPanel } from './BottomPanel';
import { CalendarPanel } from './CalendarPanel';
import { ChartFooter } from './ChartFooter';
import { ChartView, INDICATORS, type ChartHandle, type ChartType, type DrawTool, type Scale } from './Chart';
import { Details } from './Details';
import { LeftRail } from './LeftRail';
import { OrderTicket } from './OrderTicket';
import { SymbolSearch } from './SymbolSearch';
import { Toolbar } from './Toolbar';
import { Watchlist } from './Watchlist';

type RightTab = 'watchlist' | 'trade' | 'alerts' | 'details' | 'calendar' | 'ai';

const RIGHT_TABS: Array<{ id: RightTab; label: string; icon: () => JSX.Element }> = [
    { id: 'watchlist', label: 'Watchlist', icon: Ic.list },
    { id: 'trade', label: 'Trade', icon: Ic.bolt },
    { id: 'alerts', label: 'Alerts', icon: Ic.bell },
    { id: 'details', label: 'Details', icon: Ic.info },
    { id: 'calendar', label: 'Economic calendar', icon: Ic.calendar },
    { id: 'ai', label: 'MaxAI', icon: Ic.sparkle },
];

const decodeSymbol = (s?: string) => (s ? decodeURIComponent(s).replace('-', '/').toUpperCase() : null);

export function Terminal() {
    const { user, updateMe } = useAuth();
    const toast = useToast();
    const params = useParams<{ symbol?: string }>();
    const nav = useNavigate();
    const loc = useLocation();
    const [lastSymbol, setLastSymbol] = useStored('tx.symbol', 'BTC/USDT');
    const symbol = decodeSymbol(params.symbol) ?? lastSymbol;
    const [timeframe, setTimeframe] = useStored<Timeframe>('tx.tf', '1h');
    const [chartType, setChartType] = useStored<ChartType>('tx.type', 'candle_solid');
    const [indicators, setIndicators] = useStored<string[]>('tx.ind', ['VOL']);
    const [scale, setScale] = useStored<Scale>('tx.scale', 'normal');
    const [showRight, setShowRight] = useStored('tx.right', true);
    const [showBottom, setShowBottom] = useStored('tx.bottom', true);
    const [showPositions, setShowPositions] = useStored('tx.pos', true);
    const [rightTab, setRightTab] = useStored<RightTab>('tx.rtab', 'watchlist');
    const [tool, setTool] = useState<DrawTool>('cursor');
    const [locked, setLocked] = useState(false);
    const [hidden, setHidden] = useState(false);
    const [search, setSearch] = useState(false);
    const [hover, setHover] = useState<KLineData | null>(null);
    const [bars, setBars] = useState(0);
    const [alertPrefill, setAlertPrefill] = useState(0);
    const [draft, setDraft] = useState<PositionDraft | null>(null);
    const [customInds, setCustomInds] = useState<CustomIndicator[]>([]);
    const [manage, setManage] = useState(false);
    const [botChart, setBotChart] = useState<BotChartData | null>(null);
    const [sp, setSp] = useSearchParams();
    const botParam = sp.get('bot') || '';
    const [toolVolume, setToolVolume] = useStored('tx.toolvol', 0.1);
    const chart = useRef<ChartHandle>(null);
    const quote = useQuote(symbol);
    const dayOpen = useDayOpen(symbol);

    const acc = primaryAccount(user);
    const accountId = accountIdOf(acc);
    const book = usePositions(accountId);
    const watchlist = user?.watchlist?.length ? user.watchlist : DEFAULT_WATCHLIST;

    useEffect(() => { setLastSymbol(symbol); }, [symbol, setLastSymbol]);
    useEffect(() => { listIndicators().then(setCustomInds).catch(() => undefined); }, []);
    useEffect(() => {
        if (!botParam) { setBotChart(null); return; }
        let alive = true;
        data<BotChartData>(`/bots/${botParam}/chart`).then(d => { if (!alive) return; setBotChart(d); if (d.symbol !== symbol) nav(`/chart/${encodeURIComponent(d.symbol.replace('/', '-'))}?bot=${botParam}`, { replace: true }); }).catch(e => { toast(e.message, 'err'); });
        return () => { alive = false; };
    }, [botParam]); // eslint-disable-line react-hooks/exhaustive-deps
    const toggleCustom = async (ind: CustomIndicator) => {
        try { await toggleIndicatorApi(ind.id, !ind.enabled); setCustomInds(list => list.map(i => (i.id === ind.id ? { ...i, enabled: !i.enabled } : i))); }
        catch (e: any) { toast(e.message, 'err'); }
    };
    const clearBot = () => { const next = new URLSearchParams(sp); next.delete('bot'); setSp(next, { replace: true }); };
    useEffect(() => { setHover(null); }, [symbol, timeframe]);

    // The header search and the alert engine talk to the terminal here.
    useEffect(() => {
        if ((loc.state as any)?.search) { setSearch(true); nav(loc.pathname, { replace: true, state: null }); }
    }, [loc, nav]);
    useEffect(() => {
        const open = () => setSearch(true);
        window.addEventListener('tx:search', open);
        return () => window.removeEventListener('tx:search', open);
    }, []);

    const pick = useCallback((s: string) => {
        setSearch(false);
        nav(`/chart/${encodeURIComponent(s.replace('/', '-'))}`);
    }, [nav]);

    const toggleWatch = useCallback((s: string) => {
        const next = watchlist.includes(s) ? watchlist.filter(x => x !== s) : [...watchlist, s];
        updateMe({ watchlist: next }).catch(e => toast(e.message, 'err'));
    }, [watchlist, updateMe, toast]);

    const toggleIndicator = (name: string) => setIndicators(list => (list.includes(name) ? list.filter(n => n !== name) : [...list, name]));

    const openRight = useCallback((tab: RightTab) => { setShowRight(true); setRightTab(tab); }, [setShowRight, setRightTab]);
    const clickRail = (tab: RightTab) => {
        if (showRight && rightTab === tab) setShowRight(false);
        else openRight(tab);
    };

    // Keyboard: "/" or Ctrl+K opens the search, Esc returns to the cursor, B/S open the ticket.
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(true); return; }
            const t = e.target as HTMLElement;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
            if (e.key === '/') { e.preventDefault(); setSearch(true); }
            else if (e.key === 'Escape') setTool('cursor');
            else if (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 's') openRight('trade');
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [openRight]);

    const onTool = (t: DrawTool) => {
        setTool(t);
        chart.current?.setTool(t, { volume: toolVolume });
        // Drawing tools are one-shot: once the shape is placed the rail
        // returns to the cursor, like every charting terminal.
        if (t !== 'cursor') setTimeout(() => setTool('cursor'), 0);
    };

    const screenshot = () => {
        const url = chart.current?.screenshot();
        if (!url) return;
        const a = document.createElement('a');
        a.href = url; a.download = `termax-${symbol.replace('/', '')}-${timeframe}.png`; a.click();
    };

    const fullscreen = () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
    };

    const onRange = (tf: Timeframe, n: number) => {
        setTimeframe(tf);
        // The new series arrives asynchronously; fit once it has drawn.
        setTimeout(() => chart.current?.fitBars(n), 900);
    };

    const onPositionDraft = useCallback((d: PositionDraft | null) => setDraft(d), []);
    useEffect(() => { setDraft(null); chart.current?.clearPositionTool(); }, [symbol]);

    const onLevelDrag = useCallback(async (positionId: string, level: 'stopLoss' | 'takeProfit', price: number) => {
        const p = book.positions.find(x => x.id === positionId);
        if (!p) return;
        // The hand lands between ticks; the order carries a price the instrument can quote.
        price = Number(price.toFixed(digitsFor(p.symbol, price)));
        try {
            await api('/trade/modify', { method: 'POST', body: { positionId, accountId, stopLoss: level === 'stopLoss' ? price : p.stopLoss, takeProfit: level === 'takeProfit' ? price : p.takeProfit, trailingStopDistance: p.trailingStopDistance || 0 } });
            toast(`${level === 'stopLoss' ? 'Stop loss' : 'Take profit'} moved to ${fmtPrice(p.symbol, price)}`, 'ok');
        } catch (e: any) {
            toast(e.message, 'err');
        } finally {
            refreshAllBooks();
        }
    }, [book.positions, accountId, toast]);

    const placeFromDraft = () => {
        if (!draft) return;
        const atMarket = quote ? Math.abs(draft.entry - quote.price) / quote.price < 0.0005 : true;
        const kind = atMarket ? 'MARKET' : (draft.side === 'BUY' ? (draft.entry < (quote?.price ?? draft.entry) ? 'LIMIT' : 'STOP') : (draft.entry > (quote?.price ?? draft.entry) ? 'LIMIT' : 'STOP'));
        setTicketDraft({ side: draft.side, kind, entry: draft.entry, stopLoss: draft.stop, takeProfit: draft.target, volume: draft.volume });
        openRight('trade');
    };

    const onStatus = useCallback((s: { loading: boolean; error: string | null; bars: number }) => { setBars(s.bars); }, []);
    const onCrosshair = useCallback((bar: KLineData | null) => setHover(bar), []);

    const chg = changePct(quote?.price, dayOpen);
    const chgAbs = quote && dayOpen ? quote.price - dayOpen : null;
    const info = infoOf(symbol);
    const legendShift = indicators.some(n => INDICATORS.find(i => i.name === n)?.pane === 'main');
    const cls = `terminal ${showRight ? '' : 'no-right'} ${showBottom ? '' : 'no-bottom'}`;

    return (
        <div className={cls}>
            <Toolbar
                symbol={symbol} timeframe={timeframe} chartType={chartType} indicators={indicators}
                showRight={showRight} showBottom={showBottom} showPositions={showPositions}
                onSymbolSearch={() => setSearch(true)} onTimeframe={setTimeframe} onChartType={setChartType}
                onToggleIndicator={toggleIndicator} onToggleRight={() => setShowRight(v => !v)} onToggleBottom={() => setShowBottom(v => !v)}
                onTogglePositions={() => setShowPositions(v => !v)} onScreenshot={screenshot} onFullscreen={fullscreen}
                onReset={() => chart.current?.resetView()} onOpenTicket={() => openRight('trade')}
                onAlert={() => { setAlertPrefill(p => p + 1); openRight('alerts'); }}
                customIndicators={customInds} onToggleCustom={toggleCustom} onManageIndicators={() => setManage(true)}
                onReplay={() => nav(`/replay?symbol=${encodeURIComponent(symbol)}&tf=${timeframe}${botParam ? `&bot=${botParam}` : ''}`)}
            />
            <LeftRail tool={tool} onTool={onTool} onUndo={() => chart.current?.removeLastDrawing()} onClear={() => chart.current?.clearDrawings()}
                locked={locked} hidden={hidden}
                onLock={() => { setLocked(v => { chart.current?.lockDrawings(!v); return !v; }); }}
                onHide={() => { setHidden(v => { chart.current?.hideDrawings(!v); return !v; }); }} />
            <section className="chart-area">
                <div className={`chart-legend ${legendShift ? 'shift' : ''}`}>
                    <div className="l1">
                        <b>{symbol}</b>
                        <span className="muted">· {timeframe.toUpperCase()} · Termax {info.cls}</span>
                        {hover ? (
                            <span className="ohlc">
                                <span>O<b>{fmtPrice(symbol, hover.open)}</b></span>
                                <span>H<b>{fmtPrice(symbol, hover.high)}</b></span>
                                <span>L<b>{fmtPrice(symbol, hover.low)}</b></span>
                                <span>C<b className={hover.close >= hover.open ? 'up' : 'down'}>{fmtPrice(symbol, hover.close)}</b></span>
                                {hover.volume ? <span>Vol<b>{Number(hover.volume).toLocaleString('en-US', { maximumFractionDigits: 0 })}</b></span> : null}
                            </span>
                        ) : (
                            <span className="ohlc">
                                <span><b className={chg == null ? '' : chg >= 0 ? 'up' : 'down'}>{fmtPrice(symbol, quote?.price)}</b></span>
                                {chgAbs != null && chg != null && <span className={chg >= 0 ? 'up' : 'down'}>{chgAbs >= 0 ? '+' : ''}{fmtPrice(symbol, chgAbs)} ({chg >= 0 ? '+' : ''}{chg.toFixed(2)}%)</span>}
                                {quote && <span className="muted">Bid <b>{fmtPrice(symbol, quote.bid)}</b> Ask <b>{fmtPrice(symbol, quote.ask)}</b></span>}
                            </span>
                        )}
                    </div>
                    {!hover && bars > 0 && <div className="ind muted small">{bars} bars · drag to pan · wheel to zoom · press / to search</div>}
                </div>
                <div className="chart-host">
                    <ChartView ref={chart} symbol={symbol} timeframe={timeframe} chartType={chartType} indicators={indicators} scale={scale}
                        positions={book.positions} showPositions={showPositions} onCrosshair={onCrosshair} onStatus={onStatus}
                        onPositionDraft={onPositionDraft} onLevelDrag={onLevelDrag}
                        customIndicators={customInds.filter(i => i.enabled)} bot={botChart} />
                </div>
                {botChart && botChart.symbol === symbol && (
                    <div className="bot-banner">
                        <span className="chip blue">Bot</span>
                        <b>{botChart.name}</b>
                        <span className="muted">{botChart.trades.length} trades on this chart · net <b className={botChart.trades.reduce((s, t) => s + t.netProfit, 0) >= 0 ? 'up' : 'down'}>{(() => { const n = botChart.trades.reduce((s, t) => s + t.netProfit, 0); return `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`; })()}</b>{botChart.open ? ` · open ${botChart.open.side} ${botChart.open.volume}` : ''}</span>
                        <button className="link-btn" onClick={() => nav(`/replay?symbol=${encodeURIComponent(symbol)}&tf=${botChart.timeframe}&bot=${botChart.botId}`)}>Replay against it</button>
                        <button className="x" onClick={clearBot} aria-label="Hide bot">×</button>
                    </div>
                )}
                {draft && (
                    <div className="draft-card">
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                            <b className={draft.side === 'BUY' ? 'up' : 'down'}>{draft.side === 'BUY' ? 'Long' : 'Short'} {symbol}</b>
                            <button className="x" onClick={() => { chart.current?.clearPositionTool(); setDraft(null); }} aria-label="Remove">×</button>
                        </div>
                        <div className="kv-list" style={{ padding: 0 }}>
                            <div><span>Entry</span><b>{fmtPrice(symbol, draft.entry)}</b></div>
                            <div><span>Target</span><b className="up">{draft.target == null ? 'click to set' : `${fmtPrice(symbol, draft.target)}  (+$${draft.reward?.toFixed(2)})`}</b></div>
                            <div><span>Stop</span><b className="down">{draft.stop == null ? 'click to set' : `${fmtPrice(symbol, draft.stop)}  (−$${draft.risk?.toFixed(2)})`}</b></div>
                            <div><span>Reward : risk</span><b>{draft.rr == null ? '—' : `${draft.rr.toFixed(2)} : 1`}</b></div>
                            <div><span>Volume</span><b className="row" style={{ gap: 4 }}>
                                <button className="link-btn" onClick={() => { const v = Math.max(0.01, +(toolVolume - 0.05).toFixed(2)); setToolVolume(v); chart.current?.setTool(tool === 'cursor' ? 'cursor' : tool); }} title="Less">−</button>
                                <input className="vol" value={toolVolume} onChange={e => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v > 0) setToolVolume(v); }} />
                                <span className="muted small">lots · redraw to apply</span>
                            </b></div>
                        </div>
                        <div className="muted small" style={{ margin: '6px 0 8px' }}>Drag any handle to adjust. Money figures are estimates in the quote currency.</div>
                        <button className={`btn block ${draft.side === 'BUY' ? 'buy' : 'sell'}`} disabled={draft.stop == null} onClick={placeFromDraft}>
                            {draft.stop == null ? 'Set the stop to continue' : `${draft.side === 'BUY' ? 'Buy' : 'Sell'} ${draft.volume} with this stop and target`}
                        </button>
                    </div>
                )}
                <ChartFooter scale={scale} onScale={setScale} onRange={onRange} onAuto={() => { setScale('normal'); chart.current?.resetView(); }} timeframe={timeframe} />
            </section>
            {showBottom && (
                <section className="bottom">
                    <BottomPanel positions={book.positions} account={book.account} accountId={accountId} loaded={book.loaded} error={book.error} onPickSymbol={pick} />
                </section>
            )}
            <aside className="rightp" hidden={!showRight}>
                <div className="rp-head"><b>{RIGHT_TABS.find(t => t.id === rightTab)?.label}</b><button className="x" onClick={() => setShowRight(false)} aria-label="Close panel">×</button></div>
                {rightTab === 'watchlist' && <Watchlist symbols={watchlist} active={symbol} onPick={pick} onAdd={toggleWatch} onRemove={toggleWatch} />}
                {rightTab === 'trade' && <div className="panel-body"><OrderTicket symbol={symbol} accountId={accountId} account={book.account} /></div>}
                {rightTab === 'alerts' && <AlertsPanel symbol={symbol} prefill={alertPrefill} />}
                {rightTab === 'details' && <Details symbol={symbol} />}
                {rightTab === 'calendar' && <CalendarPanel />}
                {rightTab === 'ai' && <Chat context={`${symbol} on the ${timeframe} chart`} />}
            </aside>
            <aside className="rrail" aria-label="Panels">
                {RIGHT_TABS.map(t => (
                    <button key={t.id} className={`rail-btn ${showRight && rightTab === t.id ? 'active' : ''}`} title={t.label} onClick={() => clickRail(t.id)}><t.icon /></button>
                ))}
            </aside>
            {manage && <IndicatorsManager onClose={() => setManage(false)} onChanged={setCustomInds} />}
            {search && <SymbolSearch onPick={pick} onClose={() => setSearch(false)} watchlist={watchlist} onToggleWatch={toggleWatch} />}
        </div>
    );
}
