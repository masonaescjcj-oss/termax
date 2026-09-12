/**
 * The trading terminal: toolbar, drawing rail, chart with its footer, the
 * right panel behind an icon rail, and the book. Layout state (panels,
 * timeframe, indicators, chart type, scale) persists per browser; the
 * watchlist persists on the account.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KLineData } from 'klinecharts';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { accountIdOf, primaryAccount, useAuth } from '../auth';
import { Chat } from '../components/Chat';
import { Ic } from '../components/icons';
import { useStored, useToast } from '../components/ui';
import { changePct, useDayOpen } from '../daychange';
import { useQuote, type Timeframe } from '../market';
import { DEFAULT_WATCHLIST, fmtPrice, infoOf } from '../symbols';
import { usePositions } from './account';
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
    const chart = useRef<ChartHandle>(null);
    const quote = useQuote(symbol);
    const dayOpen = useDayOpen(symbol);

    const acc = primaryAccount(user);
    const accountId = accountIdOf(acc);
    const book = usePositions(accountId);
    const watchlist = user?.watchlist?.length ? user.watchlist : DEFAULT_WATCHLIST;

    useEffect(() => { setLastSymbol(symbol); }, [symbol, setLastSymbol]);
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
        chart.current?.setTool(t);
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
                        positions={book.positions} showPositions={showPositions} onCrosshair={onCrosshair} onStatus={onStatus} />
                </div>
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
            {search && <SymbolSearch onPick={pick} onClose={() => setSearch(false)} watchlist={watchlist} onToggleWatch={toggleWatch} />}
        </div>
    );
}
