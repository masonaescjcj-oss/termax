import { data } from '../api';
import { useLoader } from '../components/ui';

interface Sent { symbol: string; longs: number; shorts: number; longVolume: number; shortVolume: number; traders: number; longPct: number | null }

/** Termax traders' positioning on one symbol — the long/short bar. */
export function SentimentBar({ symbol }: { symbol: string }) {
    const s = useLoader<Sent[]>(() => data(`/market/sentiment?symbols=${encodeURIComponent(symbol)}`), [symbol], { every: 60_000 });
    const row = s.data?.[0];
    if (!row || row.traders === 0 || row.longPct == null) {
        return <div style={{ padding: '4px 12px 12px' }} className="muted small">No Termax trader is positioned on {symbol} right now.</div>;
    }
    return (
        <div style={{ padding: '4px 12px 12px' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <b className="up">{row.longPct}% long</b>
                <span className="muted">{row.traders} trader{row.traders === 1 ? '' : 's'} · {row.longs + row.shorts} positions</span>
                <b className="down">{100 - row.longPct}% short</b>
            </div>
            <div className="sent big"><i style={{ width: `${row.longPct}%` }} /></div>
            <div className="row muted small" style={{ justifyContent: 'space-between', marginTop: 4 }}><span>{row.longVolume.toFixed(2)} lots</span><span>{row.shortVolume.toFixed(2)} lots</span></div>
        </div>
    );
}
