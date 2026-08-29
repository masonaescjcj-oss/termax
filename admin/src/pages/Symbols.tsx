import { useState } from 'react';
import { api, assetUrl } from '../api';
import {
    ErrorBox, Field, ImageField, Loading, Modal, TextArea, Toggle,
    confirmDestructive, useLoader, useToast,
} from '../components/ui';

type Symbol = {
    _id: string; symbol: string; name: string; description: string;
    imageUrl: string; price: number; high: number | null; low: number | null;
    changePct: string; showMetrics: boolean; brokerUrl: string; isPinned: boolean;
};

const blank = {
    symbol: '', name: '', description: '', imageUrl: '',
    price: '0', high: '', low: '', changePct: '',
    showMetrics: false, brokerUrl: '', isPinned: false,
};
type Form = typeof blank;

export default function Symbols() {
    const toast = useToast();
    const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
    const list = useLoader(() => api<{ data: Symbol[] }>('/admin/symbols').then(r => r.data), []);

    const num = (v: string) => Number(String(v).replace(/,/g, '')) || 0;

    const save = async () => {
        if (!editing) return;
        const f = editing.form;
        if (!f.symbol.trim() || !f.name.trim()) return toast.err(new Error('Symbol and name are both required.'));
        try {
            await api(editing.id ? `/admin/symbols/${editing.id}` : '/admin/symbols', {
                method: editing.id ? 'PUT' : 'POST',
                body: { ...f, price: num(f.price), high: num(f.high), low: num(f.low) },
            });
            toast.ok(editing.id ? 'Symbol updated.' : 'Symbol promoted.');
            setEditing(null);
            list.reload();
        } catch (e) { toast.err(e); }
    };

    const act = async (fn: () => Promise<any>, done: string) => {
        try { await fn(); toast.ok(done); list.reload(); } catch (e) { toast.err(e); }
    };

    return (
        <>
            <div className="row between" style={{ marginBottom: 16 }}>
                <span className="muted">{list.data?.length ?? 0} promoted</span>
                <button className="primary" onClick={() => setEditing({ id: null, form: { ...blank } })}>Promote symbol</button>
            </div>

            {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
            {list.loading ? <Loading /> : !list.data?.length ? (
                <div className="card empty">Nothing promoted yet.</div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Symbol</th><th className="num">Price</th>
                                <th>Change</th><th>Trade link</th><th style={{ width: 1 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {list.data.map(s => (
                                <tr key={s._id}>
                                    <td>
                                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                                            {s.imageUrl
                                                ? <img src={assetUrl(s.imageUrl)} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover' }} />
                                                : <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--surface-2)' }} />}
                                            <div>
                                                <strong>{s.symbol}</strong>{s.isPinned && ' 📌'}
                                                <div className="muted" style={{ fontSize: 12 }}>{s.name}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="num">{s.price}</td>
                                    <td className={String(s.changePct).trim().startsWith('-') ? 'neg' : 'pos'}>{s.changePct || '—'}</td>
                                    <td className="muted mono" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {s.brokerUrl || '—'}
                                    </td>
                                    <td>
                                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                                            <button className="small" onClick={() =>
                                                act(() => api(`/admin/symbols/${s._id}/pin`, { method: 'POST' }), s.isPinned ? 'Unpinned.' : 'Pinned.')}>
                                                {s.isPinned ? 'Unpin' : 'Pin'}
                                            </button>
                                            <button className="small" onClick={() => setEditing({
                                                id: s._id,
                                                form: {
                                                    symbol: s.symbol || '', name: s.name || '', description: s.description || '',
                                                    imageUrl: s.imageUrl || '', price: String(s.price ?? 0),
                                                    high: s.high == null ? '' : String(s.high),
                                                    low: s.low == null ? '' : String(s.low),
                                                    changePct: s.changePct || '', showMetrics: !!s.showMetrics,
                                                    brokerUrl: s.brokerUrl || '', isPinned: !!s.isPinned,
                                                },
                                            })}>Edit</button>
                                            <button className="small danger" onClick={() => {
                                                if (!confirmDestructive(`Remove ${s.symbol} from the promoted list? This is permanent.`)) return;
                                                act(() => api(`/admin/symbols/${s._id}`, { method: 'DELETE' }), 'Symbol removed.');
                                            }}>Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {editing && (
                <Modal
                    title={editing.id ? 'Edit promoted symbol' : 'Promote symbol'}
                    onClose={() => setEditing(null)}
                    footer={<>
                        <button className="ghost" onClick={() => setEditing(null)}>Cancel</button>
                        <button className="primary" onClick={save}>Save</button>
                    </>}
                >
                    {(() => {
                        const f = editing.form;
                        const set = (k: keyof Form, v: any) => setEditing({ ...editing, form: { ...f, [k]: v } });
                        return <>
                            <Field label="Symbol" value={f.symbol} onChange={v => set('symbol', v.toUpperCase())} placeholder="BTC/USDT" />
                            <Field label="Name" value={f.name} onChange={v => set('name', v)} placeholder="Bitcoin" />
                            <ImageField label="Logo" value={f.imageUrl} onChange={v => set('imageUrl', v)} />
                            <TextArea label="Description" value={f.description} onChange={v => set('description', v)} />
                            <Field label="Price" type="number" value={f.price} onChange={v => set('price', v)} />
                            <Toggle label="Show high / low / change on the card" checked={f.showMetrics} onChange={v => set('showMetrics', v)} />
                            {f.showMetrics && <>
                                <Field label="High" type="number" value={f.high} onChange={v => set('high', v)} />
                                <Field label="Low" type="number" value={f.low} onChange={v => set('low', v)} />
                                <Field label="Change" value={f.changePct} onChange={v => set('changePct', v)} placeholder="+5.20%" />
                            </>}
                            <Field label="Trade redirect URL" value={f.brokerUrl} onChange={v => set('brokerUrl', v)} placeholder="https://…" />
                            <Toggle label="Pin to the top" checked={f.isPinned} onChange={v => set('isPinned', v)} />
                        </>;
                    })()}
                </Modal>
            )}
        </>
    );
}
