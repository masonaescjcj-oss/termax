import { useEffect, useState } from 'react';
import { addAlert, clearTriggered, removeAlert, resetAlert, useAlerts } from '../alerts';
import { Field, NumberInput, ago } from '../components/ui';
import { useQuote } from '../market';
import { digitsFor, fmtPrice } from '../symbols';

export function AlertsPanel({ symbol, prefill }: { symbol: string; prefill: number }) {
    const alerts = useAlerts();
    const qt = useQuote(symbol);
    const digits = digitsFor(symbol, qt?.price);
    const [price, setPrice] = useState('');
    const [note, setNote] = useState('');
    useEffect(() => { setPrice(''); }, [symbol, prefill]);

    const target = parseFloat(price);
    const condition = qt && Number.isFinite(target) ? (target >= qt.price ? 'above' : 'below') : 'above';
    const create = () => {
        if (!Number.isFinite(target) || target <= 0) return;
        addAlert({ symbol, price: target, condition, note: note.trim() || undefined });
        setPrice(''); setNote('');
    };
    const active = alerts.filter(a => !a.triggeredAt);
    const fired = alerts.filter(a => a.triggeredAt);

    return (
        <div className="panel-body">
            <div className="ticket" style={{ paddingBottom: 6 }}>
                <div className="section-title" style={{ padding: 0 }}>New alert on {symbol}</div>
                <Field label={`Price (now ${fmtPrice(symbol, qt?.price)})`}>
                    <NumberInput value={price} onChange={setPrice} step={Math.pow(10, -digits)} digits={digits} placeholder={fmtPrice(symbol, qt?.price)} />
                </Field>
                <Field label="Note (optional)"><div className="inp"><input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. weekly high" /></div></Field>
                <button className="btn primary block" disabled={!Number.isFinite(target)} onClick={create}>
                    Alert me when {symbol} is {condition} {Number.isFinite(target) ? fmtPrice(symbol, target) : '…'}
                </button>
            </div>
            <div className="section-title">Active ({active.length})</div>
            {active.length === 0 && <div className="empty" style={{ padding: '10px 16px' }}>No active alerts.</div>}
            {active.map(a => (
                <div key={a.id} className="alert-row">
                    <div><b>{a.symbol}</b> <span className={a.condition === 'above' ? 'up' : 'down'}>{a.condition === 'above' ? '≥' : '≤'} {fmtPrice(a.symbol, a.price)}</span>{a.note && <div className="muted small">{a.note}</div>}</div>
                    <button className="link-btn red" onClick={() => removeAlert(a.id)}>Remove</button>
                </div>
            ))}
            {fired.length > 0 && (
                <>
                    <div className="section-title row" style={{ justifyContent: 'space-between' }}>Triggered ({fired.length}) <button className="link-btn" onClick={clearTriggered}>Clear</button></div>
                    {fired.map(a => (
                        <div key={a.id} className="alert-row fired">
                            <div><b>{a.symbol}</b> crossed {fmtPrice(a.symbol, a.price)} <span className="muted small">· {ago(a.triggeredAt)}</span>{a.note && <div className="muted small">{a.note}</div>}</div>
                            <div><button className="link-btn" onClick={() => resetAlert(a.id)}>Re-arm</button><button className="link-btn red" style={{ marginLeft: 8 }} onClick={() => removeAlert(a.id)}>Remove</button></div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}
