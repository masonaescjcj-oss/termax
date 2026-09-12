/**
 * Trade autopsy: what actually happened to a closed trade — the excursion
 * for and against it, what price did after the exit, and the verdicts the
 * engine draws from that — over the candle window it happened in.
 */
import { useEffect, useRef } from 'react';
import { dispose, init } from 'klinecharts';
import { data } from '../api';
import { Modal, Spinner, signed, useLoader, when } from '../components/ui';
import { fmtPrice } from '../symbols';

interface Report {
    trade: { id: string; symbol: string; side: 'BUY' | 'SELL'; volume: number; entryPrice: number; closePrice: number; openTime: string; closeTime: string; netProfit: number };
    timeframe: string;
    facts: { holdMinutes: number; pips: number; mfePips: number; maePips: number; afterExitPips: number; atrPipsAtEntry: number | null; stopPips: number | null; costs: number };
    verdicts: Array<{ key: string; en: string; evidence: Record<string, any> }>;
    candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
    context?: any;
}

const VERDICT_TONE: Record<string, string> = { stoppedThenReversed: 'amber', tightStop: 'amber', noStop: 'red', counterTrend: 'amber', costsAteIt: 'amber', gaveBackProfit: 'amber', cleanLossOrWin: 'green' };

export function AutopsyDialog({ positionId, onClose }: { positionId: string; onClose: () => void }) {
    const rep = useLoader<Report>(() => data(`/insights/autopsy/${positionId}`), [positionId]);
    const host = useRef<HTMLDivElement>(null);
    const r = rep.data;

    useEffect(() => {
        if (!r || !host.current) return;
        const c = init(host.current, { styles: { grid: { horizontal: { color: 'rgba(255,255,255,0.04)' }, vertical: { color: 'rgba(255,255,255,0.04)' } }, candle: { bar: { upColor: '#089981', downColor: '#f23645', upBorderColor: '#089981', downBorderColor: '#f23645', upWickColor: '#089981', downWickColor: '#f23645' }, tooltip: { showRule: 'none' }, priceMark: { last: { show: false } } }, xAxis: { axisLine: { color: 'rgba(255,255,255,0.09)' }, tickLine: { color: 'rgba(255,255,255,0.09)' }, tickText: { color: '#787b86', size: 10 } }, yAxis: { axisLine: { color: 'rgba(255,255,255,0.09)' }, tickLine: { color: 'rgba(255,255,255,0.09)' }, tickText: { color: '#787b86', size: 10 } } } as any });
        if (!c) return;
        c.applyNewData(r.candles.map(b => ({ timestamp: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume })));
        const t = r.trade;
        const color = t.side === 'BUY' ? '#089981' : '#f23645';
        const lbl = (id: string, price: number, text: string, col: string, dashed = false) => c.createOverlay({ id, name: 'priceLine', lock: true, points: [{ value: price }], extendData: text, styles: { line: { color: col, size: 1, style: dashed ? 'dashed' : 'solid', dashedValue: [4, 4] }, text: { color: '#fff', backgroundColor: col, size: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1 } } } as any);
        lbl('entry', t.entryPrice, `Entry ${fmtPrice(t.symbol, t.entryPrice)}`, color);
        lbl('exit', t.closePrice, `Exit ${fmtPrice(t.symbol, t.closePrice)}`, t.netProfit >= 0 ? '#089981' : '#f23645', true);
        c.createOverlay({ name: 'verticalStraightLine', lock: true, points: [{ timestamp: new Date(t.openTime).getTime() }], styles: { line: { color: 'rgba(41,98,255,0.7)', style: 'dashed', dashedValue: [4, 4] } } } as any);
        c.createOverlay({ name: 'verticalStraightLine', lock: true, points: [{ timestamp: new Date(t.closeTime).getTime() }], styles: { line: { color: 'rgba(120,123,134,0.7)', style: 'dashed', dashedValue: [4, 4] } } } as any);
        return () => { if (host.current) dispose(host.current); };
    }, [r]);

    const f = r?.facts;
    return (
        <Modal title={r ? `Autopsy — ${r.trade.side} ${r.trade.volume} ${r.trade.symbol}` : 'Autopsy'} onClose={onClose} wide>
            {rep.loading && !r ? <Spinner dark /> : !r ? <div className="note err">{rep.error}</div> : (
                <>
                    <div className="muted small">{when(r.trade.openTime)} → {when(r.trade.closeTime)} · {r.timeframe} chart · net <b className={r.trade.netProfit >= 0 ? 'up' : 'down'}>{signed(r.trade.netProfit)}</b></div>
                    <div ref={host} style={{ height: 260, marginTop: 10, border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }} />
                    <div className="stats" style={{ marginTop: 12, marginBottom: 12 }}>
                        <div className="stat"><span>Result</span><b className={f!.pips >= 0 ? 'up' : 'down'}>{f!.pips >= 0 ? '+' : ''}{f!.pips.toFixed(1)} pips</b></div>
                        <div className="stat"><span>Best in trade (MFE)</span><b className="up">+{f!.mfePips.toFixed(1)}</b></div>
                        <div className="stat"><span>Worst in trade (MAE)</span><b className="down">−{Math.abs(f!.maePips).toFixed(1)}</b></div>
                        <div className="stat"><span>After exit</span><b className={f!.afterExitPips >= 0 ? 'up' : 'down'}>{f!.afterExitPips >= 0 ? '+' : ''}{f!.afterExitPips.toFixed(1)}</b></div>
                        <div className="stat"><span>Stop</span><b>{f!.stopPips == null ? 'none' : `${f!.stopPips.toFixed(1)} pips`}{f!.atrPipsAtEntry ? <span className="muted small"> · ATR {f!.atrPipsAtEntry.toFixed(1)}</span> : null}</b></div>
                        <div className="stat"><span>Held</span><b>{f!.holdMinutes >= 60 ? `${(f!.holdMinutes / 60).toFixed(1)} h` : `${f!.holdMinutes} min`}</b></div>
                    </div>
                    <div className="section-title" style={{ paddingLeft: 0 }}>Verdicts</div>
                    {r.verdicts.length === 0 && <div className="muted">Nothing stands out — a clean trade.</div>}
                    {r.verdicts.map(v => (
                        <div key={v.key} className="row" style={{ alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid var(--line-soft)' }}>
                            <span className={`chip ${VERDICT_TONE[v.key] ?? ''}`}>{v.key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                            <span style={{ fontSize: 13 }}>{v.en}</span>
                        </div>
                    ))}
                </>
            )}
        </Modal>
    );
}
