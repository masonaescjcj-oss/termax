
import { useQuote } from '../market';
import { fmtPrice, infoOf } from '../symbols';
import { useLoader } from '../components/ui';
import { data } from '../api';
import { SentimentBar } from './Sentiment';

export function Details({ symbol }: { symbol: string }) {
    const qt = useQuote(symbol);
    const info = infoOf(symbol);
    const insight = useLoader<any>(() => data(`/tools/insight/${encodeURIComponent(symbol.replace('/', '-'))}`).catch(() => null), [symbol]);
    return (
        <div className="panel-body">
            <div className="section-title">Instrument</div>
            <div className="kv-list">
                <div><span>Symbol</span><b>{symbol}</b></div>
                <div><span>Name</span><b>{info.name}</b></div>
                <div><span>Market</span><b>{info.cls}</b></div>
                <div><span>Price decimals</span><b>{info.digits}</b></div>
            </div>
            <div className="section-title">Quote</div>
            <div className="kv-list">
                <div><span>Last</span><b>{fmtPrice(symbol, qt?.price)}</b></div>
                <div><span>Bid</span><b className="down">{fmtPrice(symbol, qt?.bid)}</b></div>
                <div><span>Ask</span><b className="up">{fmtPrice(symbol, qt?.ask)}</b></div>
                <div><span>Spread</span><b>{qt ? `${qt.spread.toFixed(1)} pips` : '—'}</b></div>
                <div><span>Updated</span><b>{qt ? new Date(qt.ts).toLocaleTimeString('en-GB') : '—'}</b></div>
            </div>
            <div className="section-title">Termax traders</div>
            <SentimentBar symbol={symbol} />
            <div className="section-title">AI insight</div>
            <div style={{ padding: '4px 12px 12px' }}>
                {insight.loading && <span className="muted">Analysing…</span>}
                {!insight.loading && !insight.data && <span className="muted">No insight available for this symbol right now.</span>}
                {insight.data && (
                    <div className="note" style={{ color: 'var(--text)' }}>
                        {typeof insight.data === 'string' ? insight.data : (insight.data.summary || insight.data.insight || insight.data.text || JSON.stringify(insight.data))}
                    </div>
                )}
            </div>
        </div>
    );
}
