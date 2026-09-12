import { useEffect, useState } from 'react';
import { addAlert, clearTriggered, rearmAlert, removeAlert, useAlerts } from '../alerts';
import { Field, NumberInput, Spinner, ago, useToast } from '../components/ui';
import { useQuote } from '../market';
import { digitsFor, fmtPrice } from '../symbols';

export function AlertsPanel({ symbol, prefill }: { symbol: string; prefill: number }) {
    const toast = useToast();
    const { alerts, loaded } = useAlerts();
    const qt = useQuote(symbol);
    const digits = digitsFor(symbol, qt?.price);
    const [price, setPrice] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => { setPrice(''); }, [symbol, prefill]);

    const target = parseFloat(price);
    const condition = qt && Number.isFinite(target) ? (target >= qt.price ? 'above' : 'below') : 'above';
    const create = async () => {
        if (!Number.isFinite(target) || target <= 0) return;
        setBusy(true);
        try {
            await addAlert({ symbol, price: target, condition, note: note.trim() || undefined });
            toast(`Alert set: ${symbol} ${condition} ${fmtPrice(symbol, target)} — you will hear about it here, in the app and on Telegram.`, 'ok');
            setPrice(''); setNote('');
        } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
    };
    const run = (fn: () => Promise<void>) => fn().catch(e => toast(e.message, 'err'));
    const active = alerts.filter(a => a.status === 'active');
    const fired = alerts.filter(a => a.status === 'triggered');

    return (
        <div className="panel-body">
            <div className="ticket" style={{ paddingBottom: 6 }}>
                <div className="section-title" style={{ padding: 0 }}>New alert on {symbol}</div>
                <Field label={`Price (now ${fmtPrice(symbol, qt?.price)})`}>
                    <NumberInput value={price} onChange={setPrice} step={Math.pow(10, -digits)} digits={digits} placeholder={fmtPrice(symbol, qt?.price)} />
                </Field>
                <Field label="Note (optional)"><div className="inp"><input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. weekly high" /></div></Field>
                <button className="btn primary block" disabled={!Number.isFinite(target) || busy} onClick={create}>
                    {busy ? <Spinner /> : <>Alert me when {symbol} is {condition} {Number.isFinite(target) ? fmtPrice(symbol, target) : '…'}</>}
                </button>
                <div className="muted small">Checked on the server against the live feed — delivered to this terminal, the app inbox and Telegram.</div>
            </div>
            <div className="section-title">Active ({active.length})</div>
            {!loaded && <div style={{ padding: 12 }}><Spinner dark /></div>}
            {loaded && active.length === 0 && <div className="empty" style={{ padding: '10px 16px' }}>No active alerts.</div>}
            {active.map(a => (
                <div key={a.id} className="alert-row">
                    <div><b>{a.symbol}</b> <span className={a.condition === 'above' ? 'up' : 'down'}>{a.condition === 'above' ? '≥' : '≤'} {fmtPrice(a.symbol, a.price)}</span>{a.note && <div className="muted small">{a.note}</div>}</div>
                    <button className="link-btn red" onClick={() => run(() => removeAlert(a.id))}>Remove</button>
                </div>
            ))}
            {fired.length > 0 && (
                <>
                    <div className="section-title row" style={{ justifyContent: 'space-between' }}>Triggered ({fired.length}) <button className="link-btn" onClick={() => run(clearTriggered)}>Clear</button></div>
                    {fired.map(a => (
                        <div key={a.id} className="alert-row fired">
                            <div><b>{a.symbol}</b> crossed {fmtPrice(a.symbol, a.price)}{a.triggeredPrice != null && <span className="muted"> at {fmtPrice(a.symbol, a.triggeredPrice)}</span>} <span className="muted small">· {ago(a.triggeredAt)}</span>{a.note && <div className="muted small">{a.note}</div>}</div>
                            <div><button className="link-btn" onClick={() => run(() => rearmAlert(a.id))}>Re-arm</button><button className="link-btn red" style={{ marginLeft: 8 }} onClick={() => run(() => removeAlert(a.id))}>Remove</button></div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}
