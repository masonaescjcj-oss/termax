import { useEffect, useState } from 'react';
import type { Timeframe } from '../market';
import type { Scale } from './Chart';

/** Range presets: the timeframe that shows the range well, and how many bars fill it. */
const RANGES: Array<{ label: string; tf: Timeframe; bars: number }> = [
    { label: '1D', tf: '5m', bars: 288 }, { label: '5D', tf: '30m', bars: 240 }, { label: '1M', tf: '4h', bars: 180 },
    { label: '3M', tf: '1d', bars: 90 }, { label: '6M', tf: '1d', bars: 180 }, { label: '1Y', tf: '1d', bars: 365 }, { label: 'All', tf: '1w', bars: 500 },
];

export function ChartFooter({ scale, onScale, onRange, onAuto, timeframe }: {
    scale: Scale; onScale: (s: Scale) => void; onRange: (tf: Timeframe, bars: number) => void; onAuto: () => void; timeframe: Timeframe;
}) {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
    const utc = now.toISOString().slice(11, 19);
    return (
        <div className="chart-footer">
            {RANGES.map(r => <button key={r.label} className="cf-btn" onClick={() => onRange(r.tf, r.bars)} title={`${r.label} on the ${r.tf} chart`}>{r.label}</button>)}
            <span className="cf-sep" />
            <span className="cf-clock" title="Chart clock (UTC)">{utc} (UTC)</span>
            <span className="grow" />
            <span className="muted small" style={{ marginRight: 6 }}>{timeframe.toUpperCase()}</span>
            <button className={`cf-btn ${scale === 'percentage' ? 'active' : ''}`} onClick={() => onScale(scale === 'percentage' ? 'normal' : 'percentage')} title="Percent scale">%</button>
            <button className={`cf-btn ${scale === 'log' ? 'active' : ''}`} onClick={() => onScale(scale === 'log' ? 'normal' : 'log')} title="Logarithmic scale">log</button>
            <button className="cf-btn" onClick={onAuto} title="Reset scale and go to the latest bar">auto</button>
        </div>
    );
}
