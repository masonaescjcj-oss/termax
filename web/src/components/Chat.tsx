/**
 * MaxAI. The same `/ai/chat` the app uses: the whole thread is sent each
 * turn, the reply may carry a widget (a chart-worthy structure the server
 * sanitised), and the day's quota comes back with every answer.
 */
import { useEffect, useRef, useState } from 'react';
import { api, data } from '../api';
import { Ic } from './icons';

type Msg = { role: 'user' | 'assistant'; content: string; widget?: any; failed?: boolean };

const STARTERS = ['What is the trend on GOLD right now?', 'Review my open positions', 'Build a bot: buy EUR/USD when RSI crosses above 30 on 15m', 'Where am I losing money this month?'];

export function Chat({ wide, context }: { wide?: boolean; context?: string }) {
    const [msgs, setMsgs] = useState<Msg[]>([]);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
    const log = useRef<HTMLDivElement>(null);

    useEffect(() => { data<any>('/ai/usage').then(u => setUsage({ used: u.used, limit: u.limit })).catch(() => {}); }, []);
    useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' }); }, [msgs, busy]);

    const send = async (content: string) => {
        const trimmed = content.trim();
        if (!trimmed || busy) return;
        const next: Msg[] = [...msgs, { role: 'user', content: trimmed }];
        setMsgs(next); setText(''); setBusy(true);
        try {
            const body = { messages: next.slice(-20).map(m => ({ role: m.role, content: m.content })) };
            if (context && next.length === 1) body.messages.unshift({ role: 'user', content: `Context: I am looking at ${context}.` });
            const res = await api<any>('/ai/chat', { method: 'POST', body });
            const reply = res?.reply;
            setMsgs(m => [...m, { role: 'assistant', content: reply?.content || '…', widget: reply?.widget ?? null }]);
            if (res?.usage) setUsage({ used: res.usage.used, limit: res.usage.limit });
        } catch (e: any) {
            setMsgs(m => [...m, { role: 'assistant', content: e?.status === 503 ? 'MaxAI is unavailable right now. Please try again in a moment.' : e?.status === 429 ? 'You have used today\'s MaxAI allowance.' : e.message, failed: true }]);
        } finally { setBusy(false); }
    };

    return (
        <div className={`chat ${wide ? 'wide' : ''}`}>
            <div className="log" ref={log}>
                {msgs.length === 0 && (
                    <div className="empty" style={{ paddingTop: wide ? 60 : 28 }}>
                        <b>MaxAI</b>Ask about a market, your positions, or describe a strategy and it will build the bot.
                    </div>
                )}
                {msgs.map((m, i) => (
                    <div key={i} className={`msg ${m.failed ? 'err' : m.role === 'user' ? 'me' : 'ai'}`}>
                        {m.content}
                        {m.widget && <Widget w={m.widget} />}
                    </div>
                ))}
                {busy && <div className="msg ai"><span className="typing"><i /><i /><i /></span></div>}
            </div>
            {msgs.length === 0 && (
                <div className="starters">{STARTERS.map(s => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>
            )}
            <div className="composer">
                <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Message MaxAI…" rows={1}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }} />
                <button className="btn primary" style={{ width: 44, padding: 0 }} onClick={() => send(text)} disabled={busy || !text.trim()} aria-label="Send"><span style={{ width: 18, height: 18, display: 'inline-flex' }}><Ic.send /></span></button>
            </div>
            {usage && <div className="quota">{usage.used} of {usage.limit} messages used today</div>}
        </div>
    );
}

function Widget({ w }: { w: any }) {
    if (!w || typeof w !== 'object') return null;
    const rows: Array<[string, any]> = [];
    const src = w.data && typeof w.data === 'object' ? w.data : w;
    for (const [k, v] of Object.entries(src)) {
        if (k === 'type' || k === 'kind') continue;
        if (v == null || typeof v === 'object') continue;
        rows.push([k, v]);
    }
    if (!rows.length) return null;
    return (
        <div className="kv-list" style={{ marginTop: 8, padding: 0, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
            {(w.title || w.type) && <div style={{ borderBottom: 0, fontWeight: 700, padding: '6px 10px' }}>{w.title || w.type}</div>}
            {rows.slice(0, 12).map(([k, v]) => <div key={k} style={{ padding: '4px 10px' }}><span>{k}</span><b>{String(v)}</b></div>)}
        </div>
    );
}
