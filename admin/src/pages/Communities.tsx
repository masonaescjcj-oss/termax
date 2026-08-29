import { useState } from 'react';
import { api, assetUrl } from '../api';
import {
    ErrorBox, Field, ImageField, Loading, Modal, Select, TextArea,
    confirmDestructive, useLoader, useToast,
} from '../components/ui';

type Community = {
    _id: string; name: string; description: string; iconColor: string;
    imageUrl: string; category: string; memberCount: number;
    admins: string[]; moderators: string[];
};

const blank = { name: '', description: '', iconColor: '#A855F7', imageUrl: '', category: 'General' };
type Form = typeof blank;

export default function Communities() {
    const toast = useToast();
    const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
    const [assigning, setAssigning] = useState<{ id: string; name: string; identifier: string; role: string } | null>(null);

    const list = useLoader(() => api<{ data: Community[] }>('/admin/communities').then(r => r.data), []);

    const save = async () => {
        if (!editing) return;
        if (!editing.form.name.trim()) return toast.err(new Error('A name is required.'));
        try {
            await api(editing.id ? `/admin/communities/${editing.id}` : '/admin/communities',
                { method: editing.id ? 'PUT' : 'POST', body: editing.form });
            toast.ok(editing.id ? 'Community updated.' : 'Community created.');
            setEditing(null);
            list.reload();
        } catch (e) { toast.err(e); }
    };

    const assign = async () => {
        if (!assigning) return;
        if (!assigning.identifier.trim()) return toast.err(new Error('Enter a username or email.'));
        try {
            await api(`/admin/communities/${assigning.id}/admins`, {
                method: 'POST',
                body: { targetUserIdentifier: assigning.identifier.trim(), role: assigning.role },
            });
            toast.ok('Role assigned.');
            setAssigning(null);
            list.reload();
        } catch (e) { toast.err(e); }
    };

    return (
        <>
            <div className="row between" style={{ marginBottom: 16 }}>
                <span className="muted">{list.data?.length ?? 0} active</span>
                <button className="primary" onClick={() => setEditing({ id: null, form: { ...blank } })}>Create community</button>
            </div>

            {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
            {list.loading ? <Loading /> : !list.data?.length ? (
                <div className="card empty">No communities yet.</div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Community</th><th>Category</th>
                                <th className="num">Members</th><th className="num">Staff</th>
                                <th style={{ width: 1 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {list.data.map(c => (
                                <tr key={c._id}>
                                    <td>
                                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                                            {c.imageUrl
                                                ? <img src={assetUrl(c.imageUrl)} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover' }} />
                                                : <div style={{ width: 30, height: 30, borderRadius: 6, background: c.iconColor || 'var(--surface-2)' }} />}
                                            <div>
                                                <strong>{c.name}</strong>
                                                <div className="muted" style={{ fontSize: 12 }}>{c.description || '—'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="muted">{c.category || 'General'}</td>
                                    <td className="num">{c.memberCount}</td>
                                    <td className="num muted">{(c.admins?.length || 0)}a / {(c.moderators?.length || 0)}m</td>
                                    <td>
                                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                                            <button className="small" onClick={() => setAssigning({ id: c._id, name: c.name, identifier: '', role: 'admin' })}>
                                                Staff
                                            </button>
                                            <button className="small" onClick={() => setEditing({
                                                id: c._id,
                                                form: {
                                                    name: c.name || '', description: c.description || '',
                                                    iconColor: c.iconColor || '#A855F7', imageUrl: c.imageUrl || '',
                                                    category: c.category || 'General',
                                                },
                                            })}>Edit</button>
                                            <button className="small danger" onClick={async () => {
                                                if (!confirmDestructive(`Deactivate "${c.name}"?`)) return;
                                                try {
                                                    await api(`/admin/communities/${c._id}`, { method: 'DELETE' });
                                                    toast.ok('Community deactivated.');
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
                    title={editing.id ? 'Edit community' : 'Create community'}
                    onClose={() => setEditing(null)}
                    footer={<>
                        <button className="ghost" onClick={() => setEditing(null)}>Cancel</button>
                        <button className="primary" onClick={save}>Save</button>
                    </>}
                >
                    {(() => {
                        const f = editing.form;
                        const set = (k: keyof Form, v: string) => setEditing({ ...editing, form: { ...f, [k]: v } });
                        return <>
                            <Field label="Name" value={f.name} onChange={v => set('name', v)} />
                            <TextArea label="Description" value={f.description} onChange={v => set('description', v)} />
                            <ImageField label="Image" value={f.imageUrl} onChange={v => set('imageUrl', v)} />
                            <Field label="Category" value={f.category} onChange={v => set('category', v)} />
                            <label className="field">
                                <span>Accent colour</span>
                                <div className="row" style={{ flexWrap: 'nowrap' }}>
                                    <input type="color" style={{ width: 46, padding: 2 }} value={f.iconColor} onChange={e => set('iconColor', e.target.value)} />
                                    <input value={f.iconColor} onChange={e => set('iconColor', e.target.value)} />
                                </div>
                            </label>
                        </>;
                    })()}
                </Modal>
            )}

            {assigning && (
                <Modal
                    title={`Staff for "${assigning.name}"`}
                    onClose={() => setAssigning(null)}
                    footer={<>
                        <button className="ghost" onClick={() => setAssigning(null)}>Cancel</button>
                        <button className="primary" onClick={assign}>Assign</button>
                    </>}
                >
                    <Field
                        label="Username or email"
                        value={assigning.identifier}
                        onChange={v => setAssigning({ ...assigning, identifier: v })}
                        hint="matched without case sensitivity"
                    />
                    <Select
                        label="Role"
                        value={assigning.role}
                        onChange={v => setAssigning({ ...assigning, role: v })}
                        options={[
                            { value: 'admin', label: 'Admin' },
                            { value: 'moderator', label: 'Moderator' },
                            { value: 'member', label: 'Member (clears any role)' },
                        ]}
                    />
                </Modal>
            )}
        </>
    );
}
