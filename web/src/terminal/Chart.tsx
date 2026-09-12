/**
 * The price chart. klinecharts draws; this component feeds it history from
 * `/market/candles`, rolls live ticks into the last bar, applies the chosen
 * indicators and chart type, and paints the trader's open positions as
 * price lines so entries, stops and targets sit on the chart they belong to.
 */
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { dispose, init, type Chart as KChart, type KLineData } from 'klinecharts';
import { fetchCandles, TF_MS, watch, type Quote, type Timeframe } from '../market';
import { digitsFor, fmtPrice } from '../symbols';
import type { Position } from './account';
import { draftFromPoints, ensurePositionTool, type PositionDraft, type PositionToolData } from './positionTool';
import { ensureTemplate, fetchIndicatorValues, setSeries, type CustomIndicator } from './customIndicators';
import { drawBotTrades, mapSpecIndicator, type BotChartData } from './botOverlay';

ensurePositionTool();

export type ChartType = 'candle_solid' | 'candle_stroke' | 'ohlc' | 'area' | 'line';
export type DrawTool = 'cursor' | 'longPosition' | 'shortPosition' | 'segment' | 'straightLine' | 'rayLine' | 'horizontalStraightLine' | 'verticalStraightLine' | 'priceLine' | 'priceChannelLine' | 'fibonacciLine' | 'rect' | 'simpleAnnotation' | 'simpleTag';

export interface IndicatorChoice { name: string; params?: number[]; pane: 'main' | 'sub' }

export const INDICATORS: Array<IndicatorChoice & { label: string }> = [
    { name: 'MA', label: 'Moving Average (5, 10, 30, 60)', params: [5, 10, 30, 60], pane: 'main' },
    { name: 'EMA', label: 'Exponential MA (12, 26, 50)', params: [12, 26, 50], pane: 'main' },
    { name: 'BOLL', label: 'Bollinger Bands', params: [20, 2], pane: 'main' },
    { name: 'SAR', label: 'Parabolic SAR', pane: 'main' },
    { name: 'VOL', label: 'Volume', pane: 'sub' },
    { name: 'MACD', label: 'MACD', params: [12, 26, 9], pane: 'sub' },
    { name: 'RSI', label: 'RSI (14)', params: [14], pane: 'sub' },
    { name: 'KDJ', label: 'Stochastic (KDJ)', params: [9, 3, 3], pane: 'sub' },
    { name: 'CCI', label: 'CCI (20)', params: [20], pane: 'sub' },
    { name: 'DMI', label: 'DMI / ADX', params: [14, 6], pane: 'sub' },
    { name: 'OBV', label: 'On-Balance Volume', pane: 'sub' },
    { name: 'WR', label: 'Williams %R', params: [14], pane: 'sub' },
];

export type Scale = 'normal' | 'log' | 'percentage';

export interface ChartHandle {
    setTool: (tool: DrawTool, data?: Partial<PositionToolData>) => void;
    /** Remove the position tool's drawing (after the order is placed or cancelled). */
    clearPositionTool: () => void;
    /** Zoom so roughly `n` bars fill the pane, latest bar at the right. */
    fitBars: (n: number) => void;
    lockDrawings: (locked: boolean) => void;
    hideDrawings: (hidden: boolean) => void;
    clearDrawings: () => void;
    removeLastDrawing: () => void;
    screenshot: () => string | null;
    resetView: () => void;
}

interface Props {
    symbol: string;
    timeframe: Timeframe;
    chartType: ChartType;
    indicators: string[];
    positions: Position[];
    showPositions: boolean;
    scale: Scale;
    /** Enabled custom indicators; values are fetched here per symbol/timeframe. */
    customIndicators?: CustomIndicator[];
    /** A bot whose trades, open position and spec indicators are painted on this chart. */
    bot?: BotChartData | null;
    /** The Long/Short tool changed (drawn, dragged) or was removed. */
    onPositionDraft?: (draft: PositionDraft | null) => void;
    /** A stop or target line on an open position was dragged to a new price. */
    onLevelDrag?: (positionId: string, level: 'stopLoss' | 'takeProfit', price: number) => void;
    onCrosshair?: (bar: KLineData | null) => void;
    onStatus?: (s: { loading: boolean; error: string | null; bars: number }) => void;
}

const STYLES = {
    grid: { horizontal: { color: 'rgba(255,255,255,0.04)' }, vertical: { color: 'rgba(255,255,255,0.04)' } },
    candle: {
        bar: { upColor: '#089981', downColor: '#f23645', noChangeColor: '#787b86', upBorderColor: '#089981', downBorderColor: '#f23645', upWickColor: '#089981', downWickColor: '#f23645' },
        area: { lineColor: '#2962ff', value: 'close', backgroundColor: [{ offset: 0, color: 'rgba(41,98,255,0.01)' }, { offset: 1, color: 'rgba(41,98,255,0.25)' }] },
        priceMark: {
            high: { color: '#787b86' }, low: { color: '#787b86' },
            last: { upColor: '#089981', downColor: '#f23645', noChangeColor: '#787b86', line: { style: 'dashed', dashedValue: [3, 3] } },
        },
        tooltip: { showRule: 'none' },
    },
    indicator: {
        tooltip: { showRule: 'always', showName: true, showParams: true, text: { color: '#787b86', size: 11 } },
        lastValueMark: { show: false },
    },
    xAxis: { axisLine: { color: 'rgba(255,255,255,0.09)' }, tickText: { color: '#787b86', size: 11 }, tickLine: { color: 'rgba(255,255,255,0.09)' } },
    yAxis: { axisLine: { color: 'rgba(255,255,255,0.09)' }, tickText: { color: '#787b86', size: 11 }, tickLine: { color: 'rgba(255,255,255,0.09)' } },
    separator: { color: 'rgba(255,255,255,0.08)', activeBackgroundColor: 'rgba(41,98,255,0.12)' },
    crosshair: {
        horizontal: { line: { color: '#787b86', style: 'dashed', dashedValue: [4, 2] }, text: { backgroundColor: 'rgba(30,34,45,0.92)', color: '#f0f3fa', size: 11 } },
        vertical: { line: { color: '#787b86', style: 'dashed', dashedValue: [4, 2] }, text: { backgroundColor: 'rgba(30,34,45,0.92)', color: '#f0f3fa', size: 11 } },
    },
    overlay: {
        point: { color: '#2962ff', borderColor: 'rgba(41,98,255,0.35)', activeColor: '#2962ff', activeBorderColor: 'rgba(41,98,255,0.35)' },
        line: { color: '#2962ff', size: 1 },
        rect: { color: 'rgba(41,98,255,0.15)', borderColor: '#2962ff' },
        polygon: { color: 'rgba(41,98,255,0.15)', borderColor: '#2962ff' },
        text: { color: '#f0f3fa', backgroundColor: '#2962ff' },
        rectText: { color: '#f0f3fa', backgroundColor: '#2962ff' },
    },
} as const;

/** A line at a price with a right-side label: entry, stop or target. */
function positionLine(id: string, price: number, text: string, color: string, dashed = false, draggable = false) {
    return {
        id, name: 'priceLine', lock: !draggable, groupId: 'positions',
        points: [{ value: price }],
        extendData: text,
        styles: {
            line: { color, size: 1, style: dashed ? 'dashed' : 'solid', dashedValue: [4, 4] },
            text: { color: '#fff', backgroundColor: color, size: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
        },
    } as any;
}

export const ChartView = React.forwardRef<ChartHandle, Props>(function ChartView(
    { symbol, timeframe, chartType, indicators, positions, showPositions, scale, customIndicators, bot, onPositionDraft, onLevelDrag, onCrosshair, onStatus }, ref,
) {
    const host = useRef<HTMLDivElement>(null);
    const chart = useRef<KChart | null>(null);
    const subPanes = useRef<Map<string, string>>(new Map());
    const mainInds = useRef<Set<string>>(new Set());
    const drawings = useRef<string[]>([]);
    const customPanes = useRef<Map<string, { paneId: string; main: boolean }>>(new Map());
    const botPanes = useRef<Map<string, string>>(new Map());
    const [status, setStatus] = useState<{ loading: boolean; error: string | null; bars: number }>({ loading: true, error: null, bars: 0 });
    const lastBar = useRef<KLineData | null>(null);
    const seriesKey = `${symbol}|${timeframe}`;
    const seriesRef = useRef(seriesKey);
    seriesRef.current = seriesKey;

    useEffect(() => { onStatus?.(status); }, [status, onStatus]);

    // Mount once.
    useEffect(() => {
        if (!host.current) return;
        const c = init(host.current, {
            styles: STYLES as any,
            locale: 'en-US',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        });
        if (!c) return;
        chart.current = c;
        c.setOffsetRightDistance(80);
        c.subscribeAction('onCrosshairChange' as any, (p: any) => {
            onCrosshair?.(p?.kLineData ?? null);
        });
        const ro = new ResizeObserver(() => c.resize());
        ro.observe(host.current);
        return () => {
            ro.disconnect();
            if (host.current) dispose(host.current);
            chart.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // History + live ticks for the current series.
    useEffect(() => {
        const c = chart.current;
        if (!c) return;
        let alive = true;
        setStatus({ loading: true, error: null, bars: 0 });
        c.clearData();
        lastBar.current = null;
        c.setPriceVolumePrecision(digitsFor(symbol), 0);

        fetchCandles(symbol, timeframe, 500).then(rows => {
            if (!alive || seriesRef.current !== seriesKey) return;
            const list: KLineData[] = rows.map(r => ({ timestamp: r.timestamp, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume }));
            c.applyNewData(list, false);
            lastBar.current = list[list.length - 1] ?? null;
            setStatus({ loading: false, error: list.length ? null : 'No history for this symbol yet.', bars: list.length });
        }).catch(e => {
            if (alive && seriesRef.current === seriesKey) setStatus({ loading: false, error: e?.message || 'Could not load candles.', bars: 0 });
        });

        const step = TF_MS[timeframe];
        const off = watch(symbol, (qt: Quote) => {
            if (!alive || seriesRef.current !== seriesKey) return;
            const last = lastBar.current;
            if (!last) return;
            const bucket = Math.floor(qt.ts / step) * step;
            const price = qt.price;
            if (bucket > last.timestamp) {
                // The tick opened a new bar; the one we had is closed.
                const bar: KLineData = { timestamp: bucket, open: price, high: price, low: price, close: price, volume: 0 };
                lastBar.current = bar;
                c.updateData(bar);
            } else {
                const bar: KLineData = { ...last, high: Math.max(last.high, price), low: Math.min(last.low, price), close: price };
                lastBar.current = bar;
                c.updateData(bar);
            }
        });
        return () => { alive = false; off(); };
    }, [seriesKey, symbol, timeframe]);

    // Chart type.
    useEffect(() => {
        const c = chart.current;
        if (!c) return;
        if (chartType === 'line') {
            c.setStyles({ candle: { type: 'area', area: { lineColor: '#2962ff', backgroundColor: [{ offset: 0, color: 'rgba(0,0,0,0)' }, { offset: 1, color: 'rgba(0,0,0,0)' }] } } } as any);
        } else if (chartType === 'area') {
            c.setStyles({ candle: { type: 'area', area: STYLES.candle.area } } as any);
        } else {
            c.setStyles({ candle: { type: chartType } } as any);
        }
    }, [chartType]);

    useEffect(() => { chart.current?.setStyles({ yAxis: { type: scale } } as any); }, [scale]);

    // Indicators: main-pane ones stack on the candles; sub-pane ones get a pane each.
    useEffect(() => {
        const c = chart.current;
        if (!c) return;
        const want = new Set(indicators);
        for (const name of [...mainInds.current]) {
            if (!want.has(name)) { c.removeIndicator('candle_pane', name); mainInds.current.delete(name); }
        }
        for (const [name, paneId] of [...subPanes.current]) {
            if (!want.has(name)) { c.removeIndicator(paneId, name); subPanes.current.delete(name); }
        }
        for (const name of indicators) {
            const def = INDICATORS.find(i => i.name === name);
            if (!def) continue;
            const create = { name, calcParams: def.params } as any;
            if (def.pane === 'main') {
                if (!mainInds.current.has(name)) { c.createIndicator(create, true, { id: 'candle_pane' }); mainInds.current.add(name); }
            } else if (!subPanes.current.has(name)) {
                const paneId = c.createIndicator(create, false, { height: 90, minHeight: 60 });
                if (paneId) subPanes.current.set(name, paneId);
            }
        }
    }, [indicators]);

    // Custom indicators: fetch the values for this series, register a
    // template per indicator, mount price-pane ones on the candles.
    const customKey = (customIndicators ?? []).map(i => `${i.id}:${i.color}:${i.pane}`).join('|');
    useEffect(() => {
        const c = chart.current;
        if (!c) return;
        const want = new Map((customIndicators ?? []).map(i => [i.id, i]));
        for (const [id, mount] of [...customPanes.current]) {
            if (!want.has(id)) { c.removeIndicator(mount.paneId, ensureTemplate({ id, name: id })); customPanes.current.delete(id); }
        }
        if (!want.size) return;
        let alive = true;
        fetchIndicatorValues(symbol, timeframe, 500).then(rows => {
            if (!alive || !chart.current) return;
            for (const row of rows) {
                const ind = want.get(row.id);
                if (!ind || !row.points) continue;
                setSeries(row.id, row.points);
                const name = ensureTemplate(ind);
                const existing = customPanes.current.get(ind.id);
                if (existing) { c.removeIndicator(existing.paneId, name); customPanes.current.delete(ind.id); }
                // klinecharts reads every field of a line style; a partial one throws.
                const create = { name, styles: { lines: [{ style: 'solid', smooth: false, size: 1, dashedValue: [2, 2], color: ind.color || '#ff9800' }] } } as any;
                if (ind.pane === 'price') {
                    c.createIndicator(create, true, { id: 'candle_pane' });
                    customPanes.current.set(ind.id, { paneId: 'candle_pane', main: true });
                } else {
                    const paneId = c.createIndicator(create, false, { height: 90, minHeight: 60 });
                    if (paneId) customPanes.current.set(ind.id, { paneId, main: false });
                }
            }
        }).catch(() => undefined);
        return () => { alive = false; };
    }, [customKey, seriesKey, status.bars]); // eslint-disable-line react-hooks/exhaustive-deps

    // A bot on the chart: its trades, its open position, and the
    // indicators its rules read.
    useEffect(() => {
        const c = chart.current;
        if (!c) return;
        for (const [key, paneId] of [...botPanes.current]) { c.removeIndicator(paneId, key.split('@')[0]); botPanes.current.delete(key); }
        c.removeOverlay({ groupId: 'bot' } as any);
        c.removeOverlay({ groupId: 'botOpen' } as any);
        if (!bot || bot.symbol !== symbol || status.bars === 0) return;
        drawBotTrades(c, bot);
        for (const { def } of bot.indicators) {
            const m = mapSpecIndicator(def);
            if (!m) continue;
            const key = `${m.name}@${m.params.join(',')}`;
            if (botPanes.current.has(key) || indicators.includes(m.name)) continue;
            const create = { name: m.name, calcParams: m.params } as any;
            const paneId = m.main ? (c.createIndicator(create, true, { id: 'candle_pane' }), 'candle_pane') : c.createIndicator(create, false, { height: 80, minHeight: 60 });
            if (paneId) botPanes.current.set(key, paneId);
        }
        if (bot.open) {
            const o = bot.open;
            const color = o.side === 'BUY' ? '#089981' : '#f23645';
            c.createOverlay({ ...positionLine(`botopen-${bot.botId}`, o.entryPrice, `${bot.name}: ${o.side} ${o.volume} @ ${fmtPrice(symbol, o.entryPrice)}`, color), groupId: 'botOpen' });
            if (o.stopLoss) c.createOverlay({ ...positionLine(`botsl-${bot.botId}`, o.stopLoss, `Bot SL ${fmtPrice(symbol, o.stopLoss)}`, '#f23645', true), groupId: 'botOpen' });
            if (o.takeProfit) c.createOverlay({ ...positionLine(`bottp-${bot.botId}`, o.takeProfit, `Bot TP ${fmtPrice(symbol, o.takeProfit)}`, '#089981', true), groupId: 'botOpen' });
        }
    }, [bot, symbol, status.bars]); // eslint-disable-line react-hooks/exhaustive-deps

    // Position lines.
    useEffect(() => {
        const c = chart.current;
        if (!c) return;
        c.removeOverlay({ groupId: 'positions' } as any);
        if (!showPositions) return;
        for (const p of positions) {
            if (p.symbol !== symbol || p.status === 'CLOSED') continue;
            const color = p.side === 'BUY' ? '#089981' : '#f23645';
            const tag = `${p.side} ${p.volume} @ ${fmtPrice(symbol, p.entryPrice)}${p.status === 'PENDING' ? ' (pending)' : ''}`;
            c.createOverlay(positionLine(`pos-${p.id}`, p.entryPrice, tag, color, p.status === 'PENDING'));
            // Stops and targets drag: the label follows the hand, the
            // server hears about it on release.
            const level = (kind: 'stopLoss' | 'takeProfit', price: number, prefix: string, lineColor: string) => ({
                ...positionLine(`${kind === 'stopLoss' ? 'sl' : 'tp'}-${p.id}`, price, `${prefix} ${fmtPrice(symbol, price)}`, lineColor, true, p.status === 'OPEN'),
                onPressedMoving: (e: any) => {
                    const v = e.overlay?.points?.[0]?.value;
                    if (v != null) c.overrideOverlay({ id: e.overlay.id, extendData: `${prefix} ${fmtPrice(symbol, v)} · release to apply` } as any);
                    // false: let the library move the point; true would mean "handled" and freeze it.
                    return false;
                },
                onPressedMoveEnd: (e: any) => {
                    const v = e.overlay?.points?.[0]?.value;
                    if (v != null && Math.abs(v - price) > 0) onLevelDrag?.(p.id, kind, v);
                    return true;
                },
            });
            if (p.stopLoss) c.createOverlay(level('stopLoss', p.stopLoss, 'SL', '#f23645') as any);
            if (p.takeProfit) c.createOverlay(level('takeProfit', p.takeProfit, 'TP', '#089981') as any);
        }
    }, [positions, symbol, showPositions, status.bars, onLevelDrag]);

    useImperativeHandle(ref, () => ({
        setTool(tool, data) {
            const c = chart.current;
            if (!c || tool === 'cursor') return;
            if (tool === 'longPosition' || tool === 'shortPosition') {
                c.removeOverlay({ groupId: 'positionTool' } as any);
                const extendData: PositionToolData = { side: tool === 'longPosition' ? 'BUY' : 'SELL', symbol, volume: data?.volume ?? 0.1 };
                const report = (e: any) => { onPositionDraft?.(draftFromPoints(e.overlay?.points ?? [], extendData)); return true; };
                c.createOverlay({
                    id: 'position-tool', name: 'longShortPosition', groupId: 'positionTool', extendData,
                    styles: { point: { color: '#2962ff', borderColor: 'rgba(41,98,255,0.35)', radius: 5, activeRadius: 6 } },
                    onDrawing: report, onDrawEnd: report, onPressedMoveEnd: report,
                    onRemoved: () => { onPositionDraft?.(null); return true; },
                } as any);
                return;
            }
            const id = `draw-${Date.now()}`;
            c.createOverlay({
                id, name: tool, groupId: 'drawings',
                onDrawEnd: () => { drawings.current.push(id); return true; },
                onRemoved: () => { drawings.current = drawings.current.filter(d => d !== id); return true; },
            } as any);
        },
        fitBars(n) {
            const c = chart.current;
            if (!c || !host.current) return;
            const width = host.current.clientWidth - 70;
            c.setBarSpace(Math.max(1, Math.min(50, width / Math.max(10, n))));
            c.scrollToRealTime();
        },
        lockDrawings(locked) { chart.current?.overrideOverlay({ groupId: 'drawings', lock: locked } as any); },
        hideDrawings(hidden) { chart.current?.overrideOverlay({ groupId: 'drawings', visible: !hidden } as any); },
        clearPositionTool() { chart.current?.removeOverlay({ groupId: 'positionTool' } as any); },
        clearDrawings() {
            chart.current?.removeOverlay({ groupId: 'drawings' } as any);
            drawings.current = [];
        },
        removeLastDrawing() {
            const id = drawings.current.pop();
            if (id) chart.current?.removeOverlay({ id } as any);
        },
        screenshot() {
            return chart.current?.getConvertPictureUrl(true, 'png', '#000000') ?? null;
        },
        resetView() {
            chart.current?.scrollToRealTime();
        },
    }), [symbol, onPositionDraft]);

    return (
        <>
            <div ref={host} className="kline" />
            {status.loading && <div className="chart-empty"><span className="row"><span className="spinner dark" /> Loading {symbol}…</span></div>}
            {!status.loading && status.error && <div className="chart-empty">{status.error}</div>}
        </>
    );
});
