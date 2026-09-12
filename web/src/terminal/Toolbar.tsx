import React, { useCallback, useEffect, useState } from 'react';
import { Ic } from '../components/icons';
import { useClickOutside } from '../components/ui';
import { TIMEFRAMES, useQuote, type Timeframe } from '../market';
import { badgeOf, fmtPrice, infoOf } from '../symbols';
import { changePct, useDayOpen } from '../daychange';
import { INDICATORS, type ChartType } from './Chart';

const TYPES: Array<{ id: ChartType; label: string; icon: () => React.JSX.Element }> = [
    { id: 'candle_solid', label: 'Candles', icon: Ic.candles },
    { id: 'candle_stroke', label: 'Hollow candles', icon: Ic.candles },
    { id: 'ohlc', label: 'Bars', icon: Ic.bars },
    { id: 'line', label: 'Line', icon: Ic.line },
    { id: 'area', label: 'Area', icon: Ic.area },
];

export function Toolbar(props: {
    symbol: string; timeframe: Timeframe; chartType: ChartType; indicators: string[];
    showRight: boolean; showBottom: boolean; showPositions: boolean;
    onSymbolSearch: () => void; onTimeframe: (tf: Timeframe) => void; onChartType: (t: ChartType) => void;
    onToggleIndicator: (name: string) => void; onToggleRight: () => void; onToggleBottom: () => void; onTogglePositions: () => void;
    onScreenshot: () => void; onFullscreen: () => void; onReset: () => void; onOpenTicket: () => void; onAlert: () => void;
}) {
    const { symbol, timeframe, chartType, indicators } = props;
    const quote = useQuote(symbol);
    const info = infoOf(symbol);
    const [menu, setMenu] = useState<'type' | 'ind' | null>(null);
    const closeMenu = useCallback(() => setMenu(null), []);
    const ref = useClickOutside<HTMLDivElement>(menu !== null, closeMenu);
    useEffect(() => {
        if (menu === null) return;
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [menu]);
    const T = TYPES.find(t => t.id === chartType) ?? TYPES[0];
    const dayOpen = useDayOpen(symbol);
    const chg = changePct(quote?.price, dayOpen);
    const dir = quote?.prev == null ? '' : quote.price > quote.prev ? 'up' : quote.price < quote.prev ? 'down' : '';

    return (
        <div className="toolbar" ref={ref}>
            <button className="tb-btn tb-symbol" onClick={props.onSymbolSearch} title="Symbol search (press /)">
                <span className="badge">{badgeOf(symbol)}</span>{symbol}
                <span className="muted small" style={{ fontWeight: 400, marginLeft: 2 }}>{info.cls}</span>
            </button>
            <div className="tb-quote">
                <span className={`px ${dir}`}>{quote ? fmtPrice(symbol, quote.price) : '—'}</span>
                {chg != null && <span className={`chg ${chg >= 0 ? 'up' : 'down'}`}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)}%</span>}
                {quote && <span className="muted small num">{fmtPrice(symbol, quote.bid)} / {fmtPrice(symbol, quote.ask)}</span>}
            </div>
            <span className="tb-sep" />
            <div className="tb-tf">
                {TIMEFRAMES.map(tf => (
                    <button key={tf} className={`tb-btn ${tf === timeframe ? 'active' : ''}`} onClick={() => props.onTimeframe(tf)}>{tf.toUpperCase()}</button>
                ))}
            </div>
            <span className="tb-sep" />
            <div className="rel">
                <button className={`tb-btn ${menu === 'type' ? 'active' : ''}`} onClick={() => setMenu(m => (m === 'type' ? null : 'type'))} title="Chart type"><T.icon /><Ic.chevron /></button>
                {menu === 'type' && (
                    <div className="drop">
                        {TYPES.map(t => <button key={t.id} className={t.id === chartType ? 'on' : ''} onClick={() => { props.onChartType(t.id); setMenu(null); }}><span className="row"><span style={{ width: 18, height: 18, display: 'inline-flex' }}><t.icon /></span>{t.label}</span></button>)}
                    </div>
                )}
            </div>
            <div className="rel">
                <button className={`tb-btn ${menu === 'ind' ? 'active' : ''}`} onClick={() => setMenu(m => (m === 'ind' ? null : 'ind'))} title="Indicators"><Ic.fx /><span className="lbl">Indicators</span>{indicators.length ? <span className="count" style={{ fontSize: 10, background: 'var(--blue)', color: '#fff', borderRadius: 8, padding: '0 5px' }}>{indicators.length}</span> : null}</button>
                {menu === 'ind' && (
                    <div className="drop" style={{ minWidth: 260 }}>
                        <div className="lbl">On chart</div>
                        {INDICATORS.filter(i => i.pane === 'main').map(i => <button key={i.name} className={indicators.includes(i.name) ? 'on' : ''} onClick={() => props.onToggleIndicator(i.name)}>{i.label}</button>)}
                        <div className="lbl">Separate pane</div>
                        {INDICATORS.filter(i => i.pane === 'sub').map(i => <button key={i.name} className={indicators.includes(i.name) ? 'on' : ''} onClick={() => props.onToggleIndicator(i.name)}>{i.label}</button>)}
                    </div>
                )}
            </div>
            <button className="tb-btn" onClick={props.onAlert} title="Create price alert"><Ic.bell /><span className="lbl">Alert</span></button>
            <button className={`tb-btn ${props.showPositions ? 'active' : ''}`} onClick={props.onTogglePositions} title="Show positions on chart"><Ic.price /><span className="lbl">Positions</span></button>
            <div className="grow" />
            <button className="tb-btn primary" onClick={props.onOpenTicket}><Ic.bolt /><span className="lbl">Trade</span></button>
            <span className="tb-sep" />
            <button className="tb-btn" onClick={props.onReset} title="Go to latest bar"><Ic.undo /></button>
            <button className="tb-btn" onClick={props.onScreenshot} title="Save chart image"><Ic.camera /></button>
            <button className={`tb-btn ${props.showBottom ? 'active' : ''}`} onClick={props.onToggleBottom} title="Toggle positions panel"><Ic.panel /></button>
            <button className={`tb-btn ${props.showRight ? 'active' : ''}`} onClick={props.onToggleRight} title="Toggle right panel"><Ic.sidebar /></button>
            <button className="tb-btn" onClick={props.onFullscreen} title="Fullscreen"><Ic.fullscreen /></button>
        </div>
    );
}
