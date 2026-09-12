import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../components/ui';
import { Ic } from '../components/icons';
import { badgeOf, CLASSES, search, type AssetClass } from '../symbols';
import { fmtPrice } from '../symbols';
import { useQuotes } from '../market';

export function SymbolSearch({ onPick, onClose, watchlist, onToggleWatch }: {
    onPick: (symbol: string) => void; onClose: () => void; watchlist: string[]; onToggleWatch: (s: string) => void;
}) {
    const [text, setText] = useState('');
    const [cls, setCls] = useState<AssetClass | 'All'>('All');
    const [hl, setHl] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const rows = useMemo(() => search(text, cls).slice(0, 80), [text, cls]);
    // Prices for what is on screen only.
    const quotes = useQuotes(rows.slice(0, 40).map(r => r.symbol));

    useEffect(() => { input.current?.focus(); }, []);
    useEffect(() => { setHl(0); }, [text, cls]);

    const onKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setHl(h => Math.min(rows.length - 1, h + 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setHl(h => Math.max(0, h - 1)); }
        else if (e.key === 'Enter' && rows[hl]) { onPick(rows[hl].symbol); }
    };

    return (
        <Modal onClose={onClose} className="ss">
            <div className="search">
                <span style={{ color: 'var(--muted)', width: 20, height: 20 }}><Ic.search /></span>
                <input ref={input} value={text} onChange={e => setText(e.target.value)} onKeyDown={onKey} placeholder="Search symbol — EURUSD, gold, bitcoin, apple…" />
                <button className="x" onClick={onClose} aria-label="Close">×</button>
            </div>
            <div className="cls">
                {(['All', ...CLASSES] as const).map(c => (
                    <button key={c} className={cls === c ? 'active' : ''} onClick={() => setCls(c)}>{c}</button>
                ))}
            </div>
            <div className="list">
                {rows.length === 0 && <div className="empty"><b>No matches</b>Try the ticker (BTCUSDT) or the name (Bitcoin).</div>}
                {rows.map((r, i) => {
                    const qt = quotes[r.symbol];
                    const on = watchlist.includes(r.symbol);
                    return (
                        <div key={r.symbol} className={`ss-row ${i === hl ? 'hl' : ''}`} onMouseEnter={() => setHl(i)} onClick={() => onPick(r.symbol)}>
                            <span className="badge">{badgeOf(r.symbol)}</span>
                            <span className="sym">{r.symbol}</span>
                            <span className="nm">{r.name}</span>
                            <span className="px num">{qt ? fmtPrice(r.symbol, qt.price) : ''}</span>
                            <span className="cl row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                                {r.cls}
                                <button className={`star ${on ? 'on' : ''}`} style={{ width: 18, height: 18 }} title={on ? 'Remove from watchlist' : 'Add to watchlist'}
                                    onClick={e => { e.stopPropagation(); onToggleWatch(r.symbol); }}><Ic.star on={on} /></button>
                            </span>
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
}
