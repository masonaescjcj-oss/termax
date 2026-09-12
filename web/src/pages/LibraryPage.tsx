import { useState } from 'react';
import { api, data } from '../api';
import { Empty, Modal, Spinner, pnlClass, signed, useLoader, useToast, when } from '../components/ui';

type Item = { id: string; title: string; description: string; author: string; mine: boolean; symbol: string; timeframe: string; rules: string[]; clones: number; publishedAt: string; forward: any };

export function LibraryPage() {
    const toast = useToast();
    const list = useLoader<Item[]>(() => data('/library'), []);
    const bots = useLoader<any[]>(() => data('/bots'), []);
    const [publish, setPublish] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);

    const clone = async (it: Item) => {
        setBusy(it.id);
        try { await api(`/library/${it.id}/clone`, { method: 'POST' }); toast(`"${it.title}" copied to your bots`, 'ok'); list.reload(); }
        catch (e: any) { toast(e.message, 'err'); } finally { setBusy(null); }
    };
    const unpublish = async (it: Item) => {
        if (!window.confirm(`Remove "${it.title}" from the library?`)) return;
        try { await api(`/library/${it.id}`, { method: 'DELETE' }); list.reload(); } catch (e: any) { toast(e.message, 'err'); }
    };

    return (
        <div className="page"><div className="page-inner">
            <div className="page-head">
                <div><h1>Strategy library</h1><p>Strategies other traders published, ranked by their real forward record — not their backtest.</p></div>
                <button className="btn primary" onClick={() => setPublish(true)} disabled={!bots.data?.length}>Publish a bot</button>
            </div>
            {list.loading ? <Spinner dark /> : !list.data?.length ? <Empty title="The library is empty" text="Be the first: publish one of your bots." /> : (
                <div className="cards">
                    {list.data.map(it => (
                        <div key={it.id} className="card">
                            <div className="row" style={{ justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>{it.title}</h3>{it.mine && <span className="chip blue">yours</span>}</div>
                            <div className="sub" style={{ marginTop: 4 }}>{it.symbol} · {it.timeframe} · by {it.author} · {when(it.publishedAt)}</div>
                            {it.description && <p style={{ fontSize: 12, margin: '8px 0 0' }}>{it.description}</p>}
                            <ul className="rules">{(it.rules ?? []).slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}</ul>
                            <div className="row" style={{ marginTop: 10, gap: 18 }}>
                                <div><div className="muted small">Forward net</div><b className={pnlClass(it.forward?.netProfit)}>{signed(it.forward?.netProfit)}</b></div>
                                <div><div className="muted small">Trades</div><b>{it.forward?.trades ?? 0}</b></div>
                                <div><div className="muted small">Win rate</div><b>{it.forward?.winRate != null ? `${Number(it.forward.winRate).toFixed(0)}%` : '—'}</b></div>
                                <div><div className="muted small">Clones</div><b>{it.clones}</b></div>
                            </div>
                            <div className="row" style={{ marginTop: 12 }}>
                                <button className="btn primary sm" disabled={busy === it.id} onClick={() => clone(it)}>Copy to my bots</button>
                                <span className="grow" />
                                {it.mine && <button className="link-btn red" onClick={() => unpublish(it)}>Unpublish</button>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {publish && <PublishDialog bots={bots.data ?? []} onClose={() => setPublish(false)} onDone={() => { setPublish(false); list.reload(); }} />}
        </div></div>
    );
}

function PublishDialog({ bots, onClose, onDone }: { bots: any[]; onClose: () => void; onDone: () => void }) {
    const [botId, setBotId] = useState(bots[0]?.id ?? '');
    const [title, setTitle] = useState(bots[0]?.name ?? '');
    const [description, setDescription] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const go = async () => {
        setBusy(true); setErr(null);
        try { await api('/library/publish', { method: 'POST', body: { botId, title, description } }); onDone(); }
        catch (e: any) { setErr(e.message); } finally { setBusy(false); }
    };
    return (
        <Modal title="Publish to the library" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !title.trim()} onClick={go}>{busy ? <span className="spinner" /> : 'Publish'}</button></>}>
            <div className="field"><label>Bot</label><select className="box" value={botId} onChange={e => { setBotId(e.target.value); setTitle(bots.find(b => b.id === e.target.value)?.name ?? title); }}>{bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div className="field" style={{ marginTop: 10 }}><label>Title</label><input className="box" value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div className="field" style={{ marginTop: 10 }}><label>Description</label><textarea className="box" value={description} onChange={e => setDescription(e.target.value)} placeholder="What market condition is this built for?" /></div>
            <p className="muted small">Your rules become public. Its forward record is shown next to it and updates as the bot trades.</p>
            {err && <div className="note err">{err}</div>}
        </Modal>
    );
}
