import { useState } from 'react';
import { api } from '../api';
import {
    ErrorBox, Field, Loading, Modal, Select, TextArea, Toggle,
    confirmDestructive, useLoader, useToast, when,
} from '../components/ui';

/**
 * Campaign tasks are checked by the backend, and each type reads a
 * different shape out of `config`. The editor therefore has to know the
 * shape rather than offering a free-form JSON box — a config with the wrong
 * key is a task that silently never completes, and nobody would find out
 * until a user complained.
 */
const TASK_TYPES: {
    value: string; label: string;
    fields: { key: string; label: string; type?: string; placeholder?: string; default?: any }[];
}[] = [
    { value: 'CONNECT_BROKER', label: 'Connect a trading account', fields: [] },
    { value: 'VISIT_LINK', label: 'Visit a link', fields: [
        { key: 'url', label: 'URL', placeholder: 'https://t.me/…' },
    ] },
    { value: 'DAILY_CHECK', label: 'Daily check-in', fields: [
        { key: 'days', label: 'Days in a row', type: 'number', default: 3 },
    ] },
    { value: 'REFERRAL', label: 'Invite people', fields: [
        { key: 'minReferrals', label: 'Referrals needed', type: 'number', default: 1 },
    ] },
    { value: 'TRADE_COUNT', label: 'Close N trades', fields: [
        { key: 'minTrades', label: 'Closed trades', type: 'number', default: 10 },
        { key: 'accountType', label: 'Account type', placeholder: 'DEMO', default: 'DEMO' },
    ] },
    { value: 'WIN_RATE', label: 'Hold a win rate', fields: [
        { key: 'minRate', label: 'Minimum win rate %', type: 'number', default: 60 },
        { key: 'lastNTrades', label: 'Over the last N trades', type: 'number', default: 5 },
        { key: 'accountType', label: 'Account type', default: 'DEMO' },
    ] },
    { value: 'WIN_STREAK', label: 'Win streak', fields: [
        { key: 'minStreak', label: 'Wins in a row', type: 'number', default: 3 },
        { key: 'accountType', label: 'Account type', default: 'DEMO' },
    ] },
    { value: 'BALANCE_GROWTH', label: 'Reach a balance', fields: [
        { key: 'targetBalance', label: 'Target balance', type: 'number', default: 3000 },
        { key: 'accountType', label: 'Account type', default: 'DEMO' },
    ] },
    { value: 'BALANCE_MULTIPLY', label: 'Multiply the starting balance', fields: [
        { key: 'multiplier', label: 'Multiplier', type: 'number', default: 3 },
        { key: 'initialBalance', label: 'Starting balance', type: 'number', default: 1000 },
    ] },
];

type Task = { taskId: string; title: string; description: string; taskType: string; config: Record<string, any> };
type Campaign = {
    _id: string; title: string; description: string; rewardLottieKey: string;
    accentColor: string; tasks: Task[]; maxParticipants: number;
    currentParticipants: number; isActive: boolean; createdAt: string;
};

const blankCampaign = {
    title: '', description: '', rewardLottieKey: 'nft_rocket',
    accentColor: '#3B82F6', maxParticipants: '0', isActive: true,
    tasks: [] as Task[],
};
type Form = typeof blankCampaign;

const slugId = (title: string) =>
    `task_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32) || Date.now()}`;

export default function Campaigns() {
    const toast = useToast();
    const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
    const [task, setTask] = useState<{ index: number | null; value: Task } | null>(null);

    const list = useLoader(() => api<{ campaigns: Campaign[] }>('/campaigns/admin/list').then(r => r.campaigns || []), []);
    const lotties = useLoader(() => api<{ lotties: { key: string; name: string }[] }>('/admin/lotties').then(r => r.lotties || []), []);

    const lottieOptions = [
        ...['nft_rocket', 'nft_star', 'nft_fire', 'nft_heart', 'nft_party'].map(k => ({ value: k, label: `${k} (built in)` })),
        ...(lotties.data || []).map(l => ({ value: l.key, label: `${l.key} — ${l.name}` })),
    ];

    const save = async () => {
        if (!editing) return;
        const f = editing.form;
        if (!f.title.trim()) return toast.err(new Error('A title is required.'));
        if (!f.tasks.length) return toast.err(new Error('A campaign with no tasks can never be completed. Add at least one.'));

        const body = {
            title: f.title, description: f.description,
            rewardLottieKey: f.rewardLottieKey, accentColor: f.accentColor,
            maxParticipants: Number(f.maxParticipants) || 0,
            isActive: f.isActive, tasks: f.tasks,
        };
        try {
            await api(editing.id ? `/campaigns/admin/${editing.id}` : '/campaigns/admin/create',
                { method: editing.id ? 'PUT' : 'POST', body });
            toast.ok(editing.id ? 'Campaign updated.' : 'Campaign created.');
            setEditing(null);
            list.reload();
        } catch (e) { toast.err(e); }
    };

    const saveTask = () => {
        if (!task || !editing) return;
        const t = task.value;
        if (!t.title.trim()) return toast.err(new Error('The task needs a title.'));
        const withId: Task = { ...t, taskId: t.taskId || slugId(t.title) };

        const tasks = [...editing.form.tasks];
        if (task.index === null) tasks.push(withId);
        else tasks[task.index] = withId;

        setEditing({ ...editing, form: { ...editing.form, tasks } });
        setTask(null);
    };

    const typeDef = TASK_TYPES.find(t => t.value === task?.value.taskType) || TASK_TYPES[0];

    return (
        <>
            <div className="row between" style={{ marginBottom: 16 }}>
                <span className="muted">{list.data?.length ?? 0} campaigns</span>
                <button className="primary" onClick={() => setEditing({ id: null, form: { ...blankCampaign, tasks: [] } })}>
                    New campaign
                </button>
            </div>

            {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
            {list.loading ? <Loading /> : !list.data?.length ? (
                <div className="card empty">No campaigns yet.</div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Campaign</th><th className="num">Tasks</th>
                                <th className="num">Joined</th><th>State</th>
                                <th>Created</th><th style={{ width: 1 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {list.data.map(c => (
                                <tr key={c._id}>
                                    <td>
                                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                                            <span style={{ width: 8, height: 28, borderRadius: 4, background: c.accentColor || 'var(--primary)' }} />
                                            <div>
                                                <strong>{c.title}</strong>
                                                <div className="muted" style={{ fontSize: 12 }}>{c.description || '—'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="num">{c.tasks?.length || 0}</td>
                                    <td className="num">
                                        {c.currentParticipants}{c.maxParticipants ? ` / ${c.maxParticipants}` : ''}
                                    </td>
                                    <td>{c.isActive ? <span className="pill mod">live</span> : <span className="pill">paused</span>}</td>
                                    <td className="muted">{when(c.createdAt)}</td>
                                    <td>
                                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                                            <button className="small" onClick={() => setEditing({
                                                id: c._id,
                                                form: {
                                                    title: c.title || '', description: c.description || '',
                                                    rewardLottieKey: c.rewardLottieKey || 'nft_rocket',
                                                    accentColor: c.accentColor || '#3B82F6',
                                                    maxParticipants: String(c.maxParticipants ?? 0),
                                                    isActive: !!c.isActive,
                                                    tasks: (c.tasks || []).map(t => ({ ...t, config: t.config || {} })),
                                                },
                                            })}>Edit</button>
                                            <button className="small danger" onClick={async () => {
                                                if (!confirmDestructive(`Delete "${c.title}"? Participants lose their progress.`)) return;
                                                try {
                                                    await api(`/campaigns/admin/${c._id}`, { method: 'DELETE' });
                                                    toast.ok('Campaign deleted.');
                                                    list.reload();
                                                } catch (e) { toast.err(e); }
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
                    wide
                    title={editing.id ? 'Edit campaign' : 'New campaign'}
                    onClose={() => setEditing(null)}
                    footer={<>
                        <button className="ghost" onClick={() => setEditing(null)}>Cancel</button>
                        <button className="primary" onClick={save}>Save campaign</button>
                    </>}
                >
                    {(() => {
                        const f = editing.form;
                        const set = (k: keyof Form, v: any) => setEditing({ ...editing, form: { ...f, [k]: v } });
                        return <>
                            <Field label="Title" value={f.title} onChange={v => set('title', v)} />
                            <TextArea label="Description" value={f.description} onChange={v => set('description', v)} />
                            <Select label="Reward animation" value={f.rewardLottieKey} onChange={v => set('rewardLottieKey', v)} options={lottieOptions} />
                            <label className="field">
                                <span>Accent colour</span>
                                <div className="row" style={{ flexWrap: 'nowrap' }}>
                                    <input type="color" style={{ width: 46, padding: 2 }} value={f.accentColor} onChange={e => set('accentColor', e.target.value)} />
                                    <input value={f.accentColor} onChange={e => set('accentColor', e.target.value)} />
                                </div>
                            </label>
                            <Field label="Participant cap" type="number" value={f.maxParticipants} onChange={v => set('maxParticipants', v)} hint="0 means no cap" />
                            <Toggle label="Live (visible in the app)" checked={f.isActive} onChange={v => set('isActive', v)} />

                            <div className="row between" style={{ margin: '18px 0 8px' }}>
                                <strong>Tasks ({f.tasks.length})</strong>
                                <button className="small" onClick={() => setTask({
                                    index: null,
                                    value: { taskId: '', title: '', description: '', taskType: 'CONNECT_BROKER', config: {} },
                                })}>Add task</button>
                            </div>

                            {!f.tasks.length ? (
                                <p className="muted" style={{ marginTop: 0 }}>
                                    No tasks yet — a campaign with none can never be completed.
                                </p>
                            ) : (
                                <div className="table-wrap">
                                    <table>
                                        <tbody>
                                            {f.tasks.map((t, i) => (
                                                <tr key={t.taskId || i}>
                                                    <td>
                                                        <strong>{t.title}</strong>
                                                        <div className="muted mono" style={{ fontSize: 11 }}>
                                                            {t.taskType}
                                                            {Object.keys(t.config || {}).length
                                                                ? ` · ${Object.entries(t.config).map(([k, v]) => `${k}=${v}`).join(', ')}`
                                                                : ''}
                                                        </div>
                                                    </td>
                                                    <td style={{ width: 1, whiteSpace: 'nowrap' }}>
                                                        <button className="small" onClick={() => setTask({ index: i, value: { ...t, config: { ...t.config } } })}>Edit</button>
                                                        {' '}
                                                        <button className="small danger" onClick={() =>
                                                            set('tasks', f.tasks.filter((_, j) => j !== i))}>Remove</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>;
                    })()}
                </Modal>
            )}

            {task && (
                <Modal
                    title={task.index === null ? 'Add task' : 'Edit task'}
                    onClose={() => setTask(null)}
                    footer={<>
                        <button className="ghost" onClick={() => setTask(null)}>Cancel</button>
                        <button className="primary" onClick={saveTask}>Save task</button>
                    </>}
                >
                    <Field label="Title" value={task.value.title} onChange={v => setTask({ ...task, value: { ...task.value, title: v } })} />
                    <TextArea label="Description" value={task.value.description} onChange={v => setTask({ ...task, value: { ...task.value, description: v } })} />
                    <Select
                        label="What has to happen"
                        value={task.value.taskType}
                        onChange={v => {
                            // Switching type makes the old config meaningless,
                            // so it is replaced with the new type's defaults
                            // rather than left to rot underneath.
                            const def = TASK_TYPES.find(t => t.value === v)!;
                            const config: Record<string, any> = {};
                            for (const fd of def.fields) if (fd.default !== undefined) config[fd.key] = fd.default;
                            setTask({ ...task, value: { ...task.value, taskType: v, config } });
                        }}
                        options={TASK_TYPES.map(t => ({ value: t.value, label: t.label }))}
                    />

                    {!typeDef.fields.length ? (
                        <p className="muted">This task needs no further settings.</p>
                    ) : typeDef.fields.map(fd => (
                        <Field
                            key={fd.key}
                            label={fd.label}
                            type={fd.type}
                            placeholder={fd.placeholder}
                            value={String(task.value.config?.[fd.key] ?? '')}
                            onChange={v => setTask({
                                ...task,
                                value: {
                                    ...task.value,
                                    config: { ...task.value.config, [fd.key]: fd.type === 'number' ? Number(v) || 0 : v },
                                },
                            })}
                        />
                    ))}
                </Modal>
            )}
        </>
    );
}
