import { useState } from 'react';
import { api, assetUrl, q } from '../api';
import {
    ErrorBox, Field, ImageField, Loading, Modal, TextArea, Toggle,
    confirmDestructive, useLoader, useToast,
} from '../components/ui';

type Broker = {
    _id: string; id: string; name: string; slug: string; logoUrl: string;
    regulation: string; rating: number; ranking: number; isPromoted: boolean;
    spreads: string; minDeposit: string; maxLeverage: string;
    platforms: string; baseCurrencies: string; features: string[];
    isActive: boolean; hasCommunity: boolean; communityName?: string;
};

const blank = {
    name: '', regulation: '', spreads: '', minDeposit: '', maxLeverage: '',
    platforms: '', baseCurrencies: '', logoUrl: '', ranking: '0',
    features: '', isPromoted: false,
};
type Form = typeof blank;

export default function Brokers() {
    const toast = useToast();
    const [showInactive, setShowInactive] = useState(false);
    const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);

    const list = useLoader(
        () => api<{ data: Broker[] }>(q('/admin/brokers/all', { includeInactive: showInactive ? '1' : '' })).then(r => r.data),
        [showInactive],
    );

    const save = async () => {
        if (!editing) return;
        const f = editing.form;
        if (!f.name.trim() || !f.regulation.trim()) {
            return toast.err(new Error('Name and regulation are both required.'));
        }
        const body = {
            ...f,
            ranking: Number(f.ranking) || 0,
            features: f.features.split(',').map(s => s.trim()).filter(Boolean),
        };
        try {
            await api(editing.id ? `/admin/brokers/${editing.id}` : '/admin/brokers',
                { method: editing.id ? 'PUT' : 'POST', body });
            toast.ok(editing.id ? 'Broker updated.' : 'Broker added.');
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
                <label className="check" style={{ margin: 0 }}>
                    <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
                    <span>Show deactivated</span>
                </label>
                <button className="primary" onClick={() => setEditing({ id: null, form: { ...blank } })}>Add broker</button>
            </div>

            {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
            {list.loading ? <Loading /> : !list.data?.length ? (
                <div className="card empty">No brokers yet.</div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Broker</th><th>Regulation</th>
                                <th className="num">Rating</th><th className="num">Rank</th>
                                <th>State</th><th style={{ width: 1 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {list.data.map(b => (
                                <tr key={b._id} style={b.isActive ? undefined : { opacity: 0.55 }}>
                                    <td>
                                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                                            {b.logoUrl
                                                ? <img src={assetUrl(b.logoUrl)} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover' }} />
                                                : <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--surface-2)' }} />}
                                            <div>
                                                <strong>{b.name}</strong>{b.isPromoted && ' ★'}
                                                <div className="muted" style={{ fontSize: 12 }}>{b.spreads} · min {b.minDeposit}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="muted">{b.regulation}</td>
                                    <td className="num">{b.rating?.toFixed?.(1) ?? b.rating}</td>
                                    <td className="num">{b.ranking}</td>
                                    <td>{b.isActive ? <span className="pill mod">active</span> : <span className="pill off">deactivated</span>}</td>
                                    <td>
                                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                                            <button className="small" onClick={() => setEditing({
                                                id: b._id,
                                                form: {
                                                    name: b.name || '', regulation: b.regulation || '',
                                                    spreads: b.spreads || '', minDeposit: b.minDeposit || '',
                                                    maxLeverage: b.maxLeverage || '', platforms: b.platforms || '',
                                                    baseCurrencies: b.baseCurrencies || '', logoUrl: b.logoUrl || '',
                                                    ranking: String(b.ranking ?? 0),
                                                    features: (b.features || []).join(', '),
                                                    isPromoted: !!b.isPromoted,
                                                },
                                            })}>Edit</button>
                                            {b.isActive ? (
                                                <button className="small danger" onClick={() => {
                                                    if (!confirmDestructive(`Deactivate ${b.name}? It disappears from the app's broker list.`)) return;
                                                    act(() => api(`/admin/brokers/${b._id}`, { method: 'DELETE' }), 'Broker deactivated.');
                                                }}>Delete</button>
                                            ) : (
                                                <button className="small" onClick={() =>
                                                    act(() => api(`/admin/brokers/${b._id}/restore`, { method: 'POST' }), 'Broker restored.')}>
                                                    Restore
                                                </button>
                                            )}
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
                    title={editing.id ? 'Edit broker' : 'Add broker'}
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
                            <Field label="Name" value={f.name} onChange={v => set('name', v)} />
                            <ImageField label="Logo" value={f.logoUrl} onChange={v => set('logoUrl', v)} />
                            <Field label="Regulation" value={f.regulation} onChange={v => set('regulation', v)} placeholder="FCA, CySEC" />
                            <Field label="Spreads" value={f.spreads} onChange={v => set('spreads', v)} placeholder="From 0.0 pips" />
                            <Field label="Minimum deposit" value={f.minDeposit} onChange={v => set('minDeposit', v)} placeholder="$50" />
                            <Field label="Max leverage" value={f.maxLeverage} onChange={v => set('maxLeverage', v)} placeholder="1:500" />
                            <Field label="Platforms" value={f.platforms} onChange={v => set('platforms', v)} placeholder="MT4, MT5, cTrader" />
                            <Field label="Base currencies" value={f.baseCurrencies} onChange={v => set('baseCurrencies', v)} placeholder="USD, EUR" />
                            <TextArea label="Features (comma separated)" value={f.features} onChange={v => set('features', v)} placeholder="Copy trading, Islamic accounts" />
                            <Field label="Ranking" type="number" value={f.ranking} onChange={v => set('ranking', v)} hint="higher sorts first" />
                            <Toggle label="Promoted" checked={f.isPromoted} onChange={v => set('isPromoted', v)} />
                        </>;
                    })()}
                </Modal>
            )}
        </>
    );
}
