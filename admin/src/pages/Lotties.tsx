import { useState } from 'react';
import { api, assetUrl } from '../api';
import {
    ErrorBox, Field, Loading, Modal, confirmDestructive, useLoader, useToast, when,
} from '../components/ui';

type Lottie = { key: string; name: string; url: string; createdAt: string };

const BUILT_IN = ['nft_rocket', 'nft_star', 'nft_fire', 'nft_heart', 'nft_party'];

export default function Lotties() {
    const toast = useToast();
    const [form, setForm] = useState<{ name: string; key: string; json: string } | null>(null);
    const load = useLoader(() => api<{ lotties: Lottie[] }>('/admin/lotties').then(r => r.lotties || []), []);

    const upload = async () => {
        if (!form) return;
        if (!form.name.trim() || !form.key.trim() || !form.json.trim()) {
            return toast.err(new Error('Name, key and a Lottie file are all needed.'));
        }
        // Validate here rather than storing something the app will choke on
        // when it tries to play it.
        try { JSON.parse(form.json); }
        catch { return toast.err(new Error('That is not valid JSON.')); }

        try {
            await api('/admin/lotties/upload', {
                method: 'POST',
                body: { name: form.name.trim(), key: form.key.trim(), lottieJson: form.json },
            });
            toast.ok('Animation uploaded.');
            setForm(null);
            load.reload();
        } catch (e) { toast.err(e); }
    };

    const readFile = (file: File | null) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const text = String(reader.result);
            try { JSON.parse(text); }
            catch { return toast.err(new Error(`${file.name} is not valid JSON.`)); }
            const base = file.name.replace(/\.json$/i, '');
            setForm({
                name: base,
                // The server accepts letters, numbers, dash and underscore
                // only, so anything else is folded away here rather than
                // being bounced back as a 400.
                key: base.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase(),
                json: text,
            });
        };
        reader.readAsText(file);
    };

    return (
        <>
            <div className="row between" style={{ marginBottom: 16 }}>
                <span className="muted">Reward animations shown when a campaign is claimed.</span>
                <button className="primary" onClick={() => setForm({ name: '', key: '', json: '' })}>Upload animation</button>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <strong style={{ display: 'block', marginBottom: 8 }}>Built into the app ({BUILT_IN.length})</strong>
                <div className="row">
                    {BUILT_IN.map(k => <span className="pill mono" key={k}>{k}</span>)}
                </div>
                <p className="muted" style={{ margin: '10px 0 0', fontSize: 12 }}>
                    These ship inside the app bundle and cannot be removed from here.
                </p>
            </div>

            {load.error && <ErrorBox message={load.error} onRetry={load.reload} />}
            {load.loading ? <Loading /> : (
                <div className="card">
                    <strong style={{ display: 'block', marginBottom: 10 }}>Uploaded ({load.data?.length ?? 0})</strong>
                    {!load.data?.length ? (
                        <p className="muted" style={{ margin: 0 }}>Nothing uploaded yet.</p>
                    ) : (
                        <table>
                            <tbody>
                                {load.data.map(l => (
                                    <tr key={l.key}>
                                        <td>
                                            <strong>{l.name}</strong>
                                            <div className="mono muted" style={{ fontSize: 12 }}>{l.key}</div>
                                        </td>
                                        <td className="muted"><a href={assetUrl(l.url)} target="_blank" rel="noreferrer">file</a></td>
                                        <td className="muted">{when(l.createdAt)}</td>
                                        <td style={{ width: 1 }}>
                                            <button className="small danger" onClick={async () => {
                                                if (!confirmDestructive(`Delete "${l.name}"? Any campaign using it falls back to the default.`)) return;
                                                try {
                                                    await api(`/admin/lotties/${encodeURIComponent(l.key)}`, { method: 'DELETE' });
                                                    toast.ok('Animation deleted.');
                                                    load.reload();
                                                } catch (e) { toast.err(e); }
                                            }}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {form && (
                <Modal
                    title="Upload a Lottie animation"
                    onClose={() => setForm(null)}
                    footer={<>
                        <button className="ghost" onClick={() => setForm(null)}>Cancel</button>
                        <button className="primary" onClick={upload}>Upload</button>
                    </>}
                >
                    <label className="field">
                        <span>Lottie JSON file</span>
                        <input type="file" accept=".json,application/json" onChange={e => { readFile(e.target.files?.[0] || null); e.target.value = ''; }} />
                    </label>
                    {form.json && <div className="notice">Loaded {(form.json.length / 1024).toFixed(0)} KB of animation data.</div>}
                    <Field label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} />
                    <Field
                        label="Key"
                        value={form.key}
                        onChange={v => setForm({ ...form, key: v })}
                        hint="letters, numbers, dash and underscore; nft_ is added if missing"
                    />
                </Modal>
            )}
        </>
    );
}
