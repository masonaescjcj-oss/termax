import { useEffect, useRef, useState } from 'react';
import { Ic } from '../components/icons';
import { useQuotes } from '../market';
import { badgeOf, fmtPrice, infoOf, search } from '../symbols';
import { changePct, useDayOpens } from '../daychange';

function Row({ symbol, active, price, prev, dayOpen, onPick, onRemove }: { symbol: string; active: boolean; price?: number; prev?: number | null; dayOpen?: number; onPick: () => void; onRemove: () => void }) {
    const [flash, setFlash] = useState('');
    const last = useRef<number | undefined>(price);
    useEffect(() => {
        if (price != null && last.current != null && price !== last.current) {
            setFlash(price > last.current ? 'tick-up' : 'tick-down');
            const t = setTimeout(() => setFlash(''), 600);
            last.current = price;
            return () => clearTimeout(t);
        }
        last.current = price;
    }, [price]);
    const dir = prev == null || price == null ? '' : price > prev ? 'up' : price < prev ? 'down' : '';
    const info = infoOf(symbol);
    const chg = changePct(price, dayOpen);
    const chgAbs = price != null && dayOpen ? price - dayOpen : null;
    return (
        <div className={`wl-row ${active ? 'active' : ''} ${flash}`} onClick={onPick}>
            <span className="badge">{badgeOf(symbol)}</span>
            <div className="ellipsis sym" title={info.name}>{symbol}</div>
            <div className={`px ${dir}`}>{fmtPrice(symbol, price)}</div>
            <div className={`chg ${chg == null ? 'muted' : chg >= 0 ? 'up' : 'down'}`}>{chgAbs == null ? '—' : `${chgAbs >= 0 ? '+' : ''}${fmtPrice(symbol, chgAbs)}`}</div>
            <div className={`chg ${chg == null ? 'muted' : chg >= 0 ? 'up' : 'down'}`}>{chg == null ? '—' : `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`}</div>
            <button className="rm" title="Remove" onClick={e => { e.stopPropagation(); onRemove(); }}><Ic.close /></button>
        </div>
    );
}

export function Watchlist({ symbols, active, onPick, onAdd, onRemove }: {
    symbols: string[]; active: string; onPick: (s: string) => void; onAdd: (s: string) => void; onRemove: (s: string) => void;
}) {
    const quotes = useQuotes(symbols);
    const opens = useDayOpens(symbols);
    const [text, setText] = useState('');
    const hits = text.trim() ? search(text).filter(s => !symbols.includes(s.symbol)).slice(0, 6) : [];
    return (
        <>
            <div className="wl-head">
                <input value={text} onChange={e => setText(e.target.value)} placeholder="Add symbol…" onKeyDown={e => { if (e.key === 'Enter' && hits[0]) { onAdd(hits[0].symbol); setText(''); } }} />
            </div>
            {hits.length > 0 && (
                <div style={{ borderBottom: '1px solid var(--line)' }}>
                    {hits.map(h => (
                        <div key={h.symbol} className="wl-row" onClick={() => { onAdd(h.symbol); setText(''); }}>
                            <span className="badge">{badgeOf(h.symbol)}</span>
                            <div className="ellipsis"><div className="sym">{h.symbol}</div><div className="nm ellipsis">{h.name}</div></div>
                            <span style={{ color: 'var(--blue)', width: 18, height: 18 }}><Ic.plus /></span>
                            <span /><span /><span />
                        </div>
                    ))}
                </div>
            )}
            <div className="wl-cols"><span /><span>Symbol</span><span className="right">Last</span><span className="right">Chg</span><span className="right">Chg%</span><span /></div>
            <div className="panel-body">
                {symbols.length === 0 && <div className="empty"><b>Your watchlist is empty</b>Add symbols above or star them in the symbol search.</div>}
                {symbols.map(s => (
                    <Row key={s} symbol={s} active={s === active} price={quotes[s]?.price} prev={quotes[s]?.prev} dayOpen={opens[s]} onPick={() => onPick(s)} onRemove={() => onRemove(s)} />
                ))}
            </div>
        </>
    );
}
