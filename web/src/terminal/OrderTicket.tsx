/**
 * The order ticket. Market, limit and stop orders against the simulated
 * book (or the linked broker, transparently — the server routes). The
 * pre-trade check from Trade DNA runs as the trader types, so a warning
 * arrives before the click, not after the fill.
 */
import { useEffect, useMemo, useState } from 'react';
import { api, data, q } from '../api';
import { Field, NumberInput, money, useToast } from '../components/ui';
import { useQuote } from '../market';
import { digitsFor, fmtPrice, infoOf } from '../symbols';
import { refreshAllBooks, type AccountState } from './account';
import { setTicketDraft, useTicketDraft } from './ticketDraft';

type Side = 'BUY' | 'SELL';
type Kind = 'MARKET' | 'LIMIT' | 'STOP';

export function OrderTicket({ symbol, accountId, account, defaultSide, compact }: {
    symbol: string; accountId: string; account: AccountState | null; defaultSide?: Side; compact?: boolean;
}) {
    const toast = useToast();
    const qt = useQuote(symbol);
    const info = infoOf(symbol);
    const [side, setSide] = useState<Side>(defaultSide ?? 'BUY');
    const [kind, setKind] = useState<Kind>('MARKET');
    const [volume, setVolume] = useState('0.10');
    const [target, setTarget] = useState('');
    const [sl, setSl] = useState('');
    const [tp, setTp] = useState('');
    const [riskPct, setRiskPct] = useState('1');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const digits = digitsFor(symbol, qt?.price);
    const step = Math.pow(10, -digits);

    useEffect(() => { setTarget(''); setSl(''); setTp(''); setError(null); }, [symbol]);
    useEffect(() => { if (defaultSide) setSide(defaultSide); }, [defaultSide]);

    // A draft from the chart's position tool fills the ticket once, then is consumed.
    const draft = useTicketDraft();
    useEffect(() => {
        if (!draft) return;
        const d = digitsFor(symbol, draft.entry ?? qt?.price);
        setSide(draft.side); setKind(draft.kind);
        if (draft.kind !== 'MARKET' && draft.entry != null) setTarget(draft.entry.toFixed(d));
        setSl(draft.stopLoss == null ? '' : draft.stopLoss.toFixed(d));
        setTp(draft.takeProfit == null ? '' : draft.takeProfit.toFixed(d));
        if (draft.volume) setVolume(draft.volume.toFixed(2));
        setTicketDraft(null);
    }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

    const vol = parseFloat(volume) || 0;
    const ref = kind === 'MARKET' ? (side === 'BUY' ? qt?.ask : qt?.bid) : parseFloat(target) || undefined;

    // Pre-trade warnings, debounced.
    useEffect(() => {
        if (!symbol || vol <= 0) { setWarnings([]); return; }
        const t = setTimeout(() => {
            data<{ warnings: Array<{ en: string }> }>(q('/insights/pre-trade', { symbol, volume: vol }))
                .then(d => setWarnings((d?.warnings ?? []).map(w => w.en)))
                .catch(() => setWarnings([]));
        }, 500);
        return () => clearTimeout(t);
    }, [symbol, vol]);

    const slNum = parseFloat(sl); const tpNum = parseFloat(tp);
    const validation = useMemo(() => {
        if (vol <= 0) return 'Volume must be above zero.';
        if (kind !== 'MARKET' && !(parseFloat(target) > 0)) return `Enter a ${kind.toLowerCase()} price.`;
        if (ref && Number.isFinite(slNum) && sl !== '') {
            if (side === 'BUY' && slNum >= ref) return 'Stop loss must be below the entry for a buy.';
            if (side === 'SELL' && slNum <= ref) return 'Stop loss must be above the entry for a sell.';
        }
        if (ref && Number.isFinite(tpNum) && tp !== '') {
            if (side === 'BUY' && tpNum <= ref) return 'Take profit must be above the entry for a buy.';
            if (side === 'SELL' && tpNum >= ref) return 'Take profit must be below the entry for a sell.';
        }
        return null;
    }, [vol, kind, target, ref, slNum, tpNum, sl, tp, side]);

    const suggestLot = async () => {
        if (!ref || !Number.isFinite(slNum)) { toast('Set a stop loss first — lot size is derived from the distance to it.', 'err'); return; }
        try {
            const res = await api<any>('/trade/calculate-lot', { method: 'POST', body: { symbol, riskPercent: parseFloat(riskPct) || 1, stopLossDistance: Math.abs(ref - slNum), accountId } });
            const lot = res?.data?.lotSize ?? res?.data?.volume ?? res?.lotSize;
            if (lot) setVolume(Number(lot).toFixed(2));
            else toast('The server did not return a lot size.', 'err');
        } catch (e: any) { toast(e.message, 'err'); }
    };

    const submit = async () => {
        if (validation) { setError(validation); return; }
        setBusy(true); setError(null);
        try {
            const body: any = { symbol, side, volume: vol, orderType: kind, accountId };
            if (kind !== 'MARKET') body.targetPrice = parseFloat(target);
            if (sl !== '' && Number.isFinite(slNum)) body.stopLoss = slNum;
            if (tp !== '' && Number.isFinite(tpNum)) body.takeProfit = tpNum;
            await api('/trade/execute', { method: 'POST', body });
            toast(`${side === 'BUY' ? 'Bought' : 'Sold'} ${vol} ${symbol}${kind !== 'MARKET' ? ` (${kind.toLowerCase()} order placed)` : ''}`, 'ok');
            refreshAllBooks();
        } catch (e: any) {
            setError(e.message);
        } finally { setBusy(false); }
    };

    const notional = ref && vol ? ref * vol * (info.cls === 'Forex' ? 100_000 : info.cls === 'Metals' && symbol === 'GOLD' ? 100 : 1) : null;

    return (
        <div className="ticket">
            <div className="sides">
                <button className={`sell ${side === 'SELL' ? 'active' : ''}`} onClick={() => setSide('SELL')}>Sell<small>{fmtPrice(symbol, qt?.bid)}</small></button>
                <button className={`buy ${side === 'BUY' ? 'active' : ''}`} onClick={() => setSide('BUY')}>Buy<small>{fmtPrice(symbol, qt?.ask)}</small></button>
            </div>
            <div className="seg">
                {(['MARKET', 'LIMIT', 'STOP'] as Kind[]).map(k => <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>{k[0] + k.slice(1).toLowerCase()}</button>)}
            </div>
            {kind !== 'MARKET' && (
                <Field label={`${kind === 'LIMIT' ? 'Limit' : 'Stop'} price`}>
                    <NumberInput value={target} onChange={setTarget} step={step} digits={digits} placeholder={fmtPrice(symbol, qt?.price)} />
                </Field>
            )}
            <Field label="Volume (lots)" hint={notional ? `≈ ${money(notional, 0)} notional` : undefined}>
                <NumberInput value={volume} onChange={setVolume} step={0.01} min={0.01} digits={2} />
            </Field>
            <div className="row" style={{ gap: 8 }}>
                <Field label="Stop loss"><NumberInput value={sl} onChange={setSl} step={step} digits={digits} placeholder="—" /></Field>
                <Field label="Take profit"><NumberInput value={tp} onChange={setTp} step={step} digits={digits} placeholder="—" /></Field>
            </div>
            {!compact && (
                <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
                    <Field label="Risk % of balance"><NumberInput value={riskPct} onChange={setRiskPct} step={0.5} min={0.1} max={10} digits={1} unit="%" /></Field>
                    <button className="btn ghost sm" style={{ height: 32 }} onClick={suggestLot} type="button">Size by risk</button>
                </div>
            )}
            {warnings.length > 0 && (
                <div className="warn"><b>Before you trade</b><ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
            )}
            {error && <div className="note err">{error}</div>}
            <button className={`btn block ${side === 'BUY' ? 'buy' : 'sell'}`} disabled={busy || !qt} onClick={submit}>
                {busy ? <span className="spinner" /> : `${side === 'BUY' ? 'Buy' : 'Sell'} ${vol > 0 ? vol.toFixed(2) : ''} ${symbol}${kind === 'MARKET' ? ' at market' : ''}`}
            </button>
            <div className="kv"><span>Free margin</span><b>{money(account?.freeMargin)}</b></div>
            <div className="kv"><span>Margin level</span><b>{account?.marginLevel ? `${account.marginLevel.toFixed(0)}%` : '—'}</b></div>
        </div>
    );
}
