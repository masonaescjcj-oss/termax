import { Fragment, useState } from 'react';
import { api, q } from '../api';
import { ErrorBox, Loading, ago, useLoader, when } from '../components/ui';

type Entry = {
    id: string; actorUsername: string | null; action: string;
    targetType: string | null; targetId: string | null;
    summary: string; detail: Record<string, unknown>; createdAt: string;
};

export default function Audit() {
    const [action, setAction] = useState('');
    const [open, setOpen] = useState<string | null>(null);
    const load = useLoader(
        () => api<{ data: Entry[]; note?: string }>(q('/admin/audit', { limit: 150, action })),
        [action],
    );

    const entries = load.data?.data || [];
    // The endpoint answers with an empty list and a note when the audit
    // table has not been created yet, so the page can say which of the two
    // "nothing here" cases this is.
    const note = load.data?.note;

    const actions = Array.from(new Set(entries.map(e => e.action))).sort();

    return (
        <>
            <div className="row" style={{ marginBottom: 16 }}>
                <select style={{ width: 'auto' }} value={action} onChange={e => setAction(e.target.value)}>
                    <option value="">Every action</option>
                    {actions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <div className="spacer" />
                <button className="small" onClick={load.reload}>Refresh</button>
            </div>

            {load.error && <ErrorBox message={load.error} onRetry={load.reload} />}

            {note && (
                <div className="notice warn">
                    The audit table is not there yet — run <span className="mono">013_admin_audit.sql</span> on
                    Supabase and everything done from this console will be recorded from then on.
                    <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>{note}</div>
                </div>
            )}

            {load.loading ? <Loading /> : !entries.length ? (
                <div className="card empty">Nothing recorded yet.</div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>When</th><th>Action</th><th>What happened</th><th>By</th><th style={{ width: 1 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(e => (
                                <Fragment key={e.id}>
                                    <tr>
                                        <td className="muted" style={{ whiteSpace: 'nowrap' }} title={when(e.createdAt)}>{ago(e.createdAt)}</td>
                                        <td><span className="pill mono">{e.action}</span></td>
                                        <td>{e.summary}</td>
                                        <td className="muted">{e.actorUsername || '—'}</td>
                                        <td>
                                            {!!Object.keys(e.detail || {}).length && (
                                                <button className="small ghost" onClick={() => setOpen(open === e.id ? null : e.id)}>
                                                    {open === e.id ? 'Hide' : 'Detail'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {open === e.id && (
                                        <tr>
                                            <td colSpan={5} style={{ background: 'var(--bg)' }}>
                                                <pre className="mono muted" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                                    {JSON.stringify(e.detail, null, 2)}
                                                </pre>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}
