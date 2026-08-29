import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, q } from '../api';
import { ErrorBox, Loading, confirmDestructive, useLoader, useToast, when } from '../components/ui';

type Review = {
    _id: string; rating: number; comment: string; isApproved: boolean;
    createdAt: string;
    userId: { id: string; username: string };
    brokerId: { id: string; name: string };
};

const SCOPES = [
    { value: 'pending', label: 'Waiting for approval' },
    { value: 'approved', label: 'Approved' },
    { value: 'all', label: 'Everything' },
];

export default function Reviews() {
    const toast = useToast();
    const [scope, setScope] = useState('pending');
    const list = useLoader(() => api<{ data: Review[] }>(q('/admin/reviews/all', { scope })).then(r => r.data), [scope]);

    const act = async (fn: () => Promise<any>, done: string) => {
        try { await fn(); toast.ok(done); list.reload(); } catch (e) { toast.err(e); }
    };

    return (
        <>
            <div className="row" style={{ marginBottom: 16 }}>
                {SCOPES.map(s => (
                    <button
                        key={s.value}
                        className={scope === s.value ? 'primary small' : 'small'}
                        onClick={() => setScope(s.value)}
                    >
                        {s.label}
                    </button>
                ))}
                <div className="spacer" />
                <span className="muted">{list.data?.length ?? 0} shown</span>
            </div>

            {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
            {list.loading ? <Loading /> : !list.data?.length ? (
                <div className="card empty">
                    {scope === 'pending' ? 'Nothing is waiting for approval.' : 'No reviews here.'}
                </div>
            ) : (
                <div className="grid" style={{ gap: 12 }}>
                    {list.data.map(r => (
                        <div className="card" key={r._id}>
                            <div className="row between" style={{ marginBottom: 8 }}>
                                <div>
                                    <strong>{r.brokerId?.name || 'Broker'}</strong>
                                    <span style={{ marginLeft: 8, color: 'var(--warning)' }}>
                                        {'★'.repeat(Math.max(0, Math.min(5, Math.round(r.rating || 0))))}
                                        <span className="muted">{'★'.repeat(5 - Math.max(0, Math.min(5, Math.round(r.rating || 0))))}</span>
                                    </span>
                                    {r.isApproved && <span className="pill mod" style={{ marginLeft: 8 }}>approved</span>}
                                </div>
                                <div className="row">
                                    {!r.isApproved && (
                                        <button className="small primary" onClick={() =>
                                            act(() => api(`/admin/reviews/${r._id}/approve`, { method: 'POST' }), 'Review approved.')}>
                                            Approve
                                        </button>
                                    )}
                                    <button className="small danger" onClick={() => {
                                        if (!confirmDestructive('Delete this review? This is permanent.')) return;
                                        act(() => api(`/admin/reviews/${r._id}`, { method: 'DELETE' }), 'Review deleted.');
                                    }}>Delete</button>
                                </div>
                            </div>

                            <p style={{ margin: '0 0 10px' }}>{r.comment || <span className="muted">No comment.</span>}</p>

                            <div className="muted" style={{ fontSize: 12 }}>
                                by {r.userId?.id
                                    ? <Link to={`/users/${r.userId.id}`}>{r.userId.username}</Link>
                                    : (r.userId?.username || 'user')} · {when(r.createdAt)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
