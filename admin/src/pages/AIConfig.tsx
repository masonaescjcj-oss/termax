import { useEffect, useState } from 'react';
import { api } from '../api';
import { ErrorBox, Field, Loading, Select, ago, useLoader, useToast } from '../components/ui';

type Config = {
    activeProvider: string; baseUrl: string; modelName: string;
    fallbackBaseUrl: string; fallbackModelName: string;
    hasApiKey: boolean; hasFallbackApiKey: boolean;
};

type Health = {
    lastOkAt: string | null;
    lastFailAt: string | null;
    lastFailMessage: string | null;
    lastServedBy: 'primary' | 'fallback' | null;
    okCount: number; failCount: number; failStreak: number;
};

type Payload = { config: Config; source: 'database' | 'legacy-file' | 'environment'; health: Health };

type Probe = { ok: boolean; message: string; latencyMs: number; sample?: string };

const PROVIDERS = [
    { value: 'nara', label: 'Nara router' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'gemini', label: 'Gemini' },
];

const blank = {
    activeProvider: 'nara', baseUrl: '', modelName: '',
    fallbackBaseUrl: '', fallbackModelName: '',
    apiKey: '', fallbackApiKey: '',
};

export default function AIConfig() {
    const toast = useToast();
    const [form, setForm] = useState({ ...blank });
    const [saving, setSaving] = useState(false);
    const [probe, setProbe] = useState<Record<'primary' | 'fallback', Probe | null>>({ primary: null, fallback: null });
    const [testing, setTesting] = useState<'primary' | 'fallback' | null>(null);
    const load = useLoader(() => api<Payload>('/admin/ai-config'), []);

    // The keys are deliberately not in the response, so the two key fields
    // start empty and blank means "keep what is stored".
    useEffect(() => {
        const c = load.data?.config;
        if (!c) return;
        setForm({
            activeProvider: c.activeProvider || 'nara',
            baseUrl: c.baseUrl || '',
            modelName: c.modelName || '',
            fallbackBaseUrl: c.fallbackBaseUrl || '',
            fallbackModelName: c.fallbackModelName || '',
            apiKey: '', fallbackApiKey: '',
        });
    }, [load.data]);

    /**
     * Test what is in the form, not what is stored — an admin wants to know
     * a pasted key works before committing it. A blank key field means
     * "test the stored one", which the server understands.
     */
    const test = async (target: 'primary' | 'fallback') => {
        setTesting(target);
        setProbe(p => ({ ...p, [target]: null }));
        try {
            const res = await api<{ result: Probe }>('/admin/ai-config/test', {
                method: 'POST',
                body: target === 'fallback'
                    ? { target, apiKey: form.fallbackApiKey, baseUrl: form.fallbackBaseUrl, modelName: form.fallbackModelName }
                    : { target, apiKey: form.apiKey, baseUrl: form.baseUrl, modelName: form.modelName },
            });
            setProbe(p => ({ ...p, [target]: res.result }));
            if (res.result.ok) toast.ok(`The ${target} provider answered in ${res.result.latencyMs}ms.`);
        } catch (e) {
            toast.err(e);
        } finally {
            setTesting(null);
        }
    };

    const save = async () => {
        if (!form.baseUrl.trim() || !form.modelName.trim()) {
            return toast.err(new Error('The primary base URL and model name are both required.'));
        }
        setSaving(true);
        try {
            await api('/admin/ai-config', { method: 'POST', body: form });
            toast.ok('AI configuration saved.');
            setForm(f => ({ ...f, apiKey: '', fallbackApiKey: '' }));
            load.reload();
        } catch (e) { toast.err(e); } finally { setSaving(false); }
    };

    if (load.loading) return <Loading />;
    if (load.error) return <ErrorBox message={load.error} onRetry={load.reload} />;

    const { config, source, health } = load.data!;
    const set = (k: keyof typeof blank, v: string) => setForm({ ...form, [k]: v });

    const ProbeLine = ({ target }: { target: 'primary' | 'fallback' }) => {
        const p = probe[target];
        if (testing === target) return <div className="notice">Asking the provider…</div>;
        if (!p) return null;
        return (
            <div className={`notice ${p.ok ? '' : 'error'}`}>
                {p.ok
                    ? <>Answered in {p.latencyMs}ms{p.sample ? <> — “{p.sample}”</> : null}</>
                    : <>{p.message}</>}
            </div>
        );
    };

    return (
        <div style={{ maxWidth: 620 }}>
            {/* Whether MaxAI is actually working, which is a different
                question from whether it is configured. */}
            <div className={`notice ${health.failStreak > 0 ? 'error' : ''}`} style={{ marginBottom: 12 }}>
                <div className="row between">
                    <strong>
                        {health.failStreak > 0
                            ? `MaxAI is failing — ${health.failStreak} request${health.failStreak === 1 ? '' : 's'} in a row`
                            : health.okCount > 0
                                ? 'MaxAI is answering'
                                : 'No AI request has been served since the last restart'}
                    </strong>
                    <button className="small" onClick={load.reload}>Refresh</button>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    {health.lastOkAt && <>Last success {ago(health.lastOkAt)}
                        {health.lastServedBy === 'fallback' && ', served by the fallback provider'} · </>}
                    {health.lastFailAt && <>last failure {ago(health.lastFailAt)} · </>}
                    {health.okCount} ok / {health.failCount} failed
                </div>
                {health.failStreak > 0 && health.lastFailMessage && (
                    <div className="mono" style={{ marginTop: 8, fontSize: 12 }}>{health.lastFailMessage}</div>
                )}
            </div>

            {source !== 'database' && (
                <div className="notice warn">
                    {source === 'environment'
                        ? <>Nothing has been saved here yet, so MaxAI is running on the key baked into the
                            server's environment. Saving below stores it in the database instead, where it
                            survives a redeploy.</>
                        : <>The running configuration is coming from a file on the server's disk, which the
                            next redeploy will delete — after which MaxAI reverts to the environment's key.
                            Press Save to move it into the database.</>}
                </div>
            )}

            <div className="notice">
                Keys are never sent back to this console — the fields below stay empty and a blank one
                leaves the stored key alone. Fill one in only to replace it. Test before saving, and the
                change reaches users on their very next message: no restart, no redeploy.
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <strong style={{ display: 'block', marginBottom: 14 }}>Primary provider</strong>
                <Select label="Provider" value={form.activeProvider} onChange={v => set('activeProvider', v)} options={PROVIDERS} />
                <Field label="Base URL" value={form.baseUrl} onChange={v => set('baseUrl', v)} placeholder="https://router.bynara.id/v1" />
                <Field label="Model name" value={form.modelName} onChange={v => set('modelName', v)} placeholder="mistral-medium-3-5" />
                <Field
                    label="API key"
                    type="password"
                    value={form.apiKey}
                    onChange={v => set('apiKey', v)}
                    placeholder={config.hasApiKey ? 'A key is stored — leave blank to keep it' : 'sk-…'}
                    hint={config.hasApiKey ? 'one is stored' : 'none stored yet'}
                />
                <div className="row">
                    <button className="small" onClick={() => test('primary')} disabled={testing !== null}>
                        Test this provider
                    </button>
                    <span className="muted" style={{ fontSize: 12 }}>
                        Sends one tiny message. Nothing is saved.
                    </span>
                </div>
                <div style={{ marginTop: 10 }}><ProbeLine target="primary" /></div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <strong style={{ display: 'block', marginBottom: 4 }}>Fallback provider</strong>
                <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
                    Used automatically when the primary one fails.
                </p>
                <Field label="Base URL" value={form.fallbackBaseUrl} onChange={v => set('fallbackBaseUrl', v)} placeholder="https://api.openai.com/v1" />
                <Field label="Model name" value={form.fallbackModelName} onChange={v => set('fallbackModelName', v)} placeholder="gpt-4o" />
                <Field
                    label="API key"
                    type="password"
                    value={form.fallbackApiKey}
                    onChange={v => set('fallbackApiKey', v)}
                    placeholder={config.hasFallbackApiKey ? 'A key is stored — leave blank to keep it' : 'sk-…'}
                    hint={config.hasFallbackApiKey ? 'one is stored' : 'none stored yet'}
                />
                {!config.hasFallbackApiKey && (
                    <div className="notice warn" style={{ marginBottom: 12 }}>
                        No fallback key is stored, so a dead primary provider means MaxAI stops for
                        everyone. With one set, a failure is retried on the fallback automatically.
                    </div>
                )}
                <div className="row">
                    <button className="small" onClick={() => test('fallback')} disabled={testing !== null}>
                        Test the fallback
                    </button>
                </div>
                <div style={{ marginTop: 10 }}><ProbeLine target="fallback" /></div>
            </div>

            <button className="primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save configuration'}
            </button>
        </div>
    );
}
