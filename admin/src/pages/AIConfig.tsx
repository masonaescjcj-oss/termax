import { useEffect, useState } from 'react';
import { api } from '../api';
import { ErrorBox, Field, Loading, Select, useLoader, useToast } from '../components/ui';

type Config = {
    activeProvider: string; baseUrl: string; modelName: string;
    fallbackBaseUrl: string; fallbackModelName: string;
    hasApiKey: boolean; hasFallbackApiKey: boolean;
};

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
    const load = useLoader(() => api<{ config: Config }>('/admin/ai-config').then(r => r.config), []);

    // The keys are deliberately not in the response, so the two key fields
    // start empty and blank means "keep what is stored".
    useEffect(() => {
        if (!load.data) return;
        setForm({
            activeProvider: load.data.activeProvider || 'nara',
            baseUrl: load.data.baseUrl || '',
            modelName: load.data.modelName || '',
            fallbackBaseUrl: load.data.fallbackBaseUrl || '',
            fallbackModelName: load.data.fallbackModelName || '',
            apiKey: '', fallbackApiKey: '',
        });
    }, [load.data]);

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

    const set = (k: keyof typeof blank, v: string) => setForm({ ...form, [k]: v });

    return (
        <div style={{ maxWidth: 620 }}>
            <div className="notice">
                Keys are never sent back to this console — the fields below stay empty and a blank one
                leaves the stored key alone. Fill one in only to replace it.
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
                    placeholder={load.data!.hasApiKey ? 'A key is stored — leave blank to keep it' : 'sk-…'}
                    hint={load.data!.hasApiKey ? 'one is stored' : 'none stored yet'}
                />
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
                    placeholder={load.data!.hasFallbackApiKey ? 'A key is stored — leave blank to keep it' : 'sk-…'}
                    hint={load.data!.hasFallbackApiKey ? 'one is stored' : 'none stored yet'}
                />
            </div>

            <button className="primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save configuration'}
            </button>
        </div>
    );
}
