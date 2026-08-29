import { Link } from 'react-router-dom';
import { api } from '../api';
import { ErrorBox, Loading, ago, useLoader } from '../components/ui';

type Stats = {
    totalUsers: number; totalBrokers: number; totalPositions: number;
    pendingReviews: number; totalCommunities: number; totalPromoted: number;
};

export default function Dashboard() {
    const stats = useLoader(() => api<{ data: Stats }>('/admin/stats').then(r => r.data), []);
    const audit = useLoader(() => api<{ data: any[] }>('/admin/audit?limit=8').then(r => r.data), []);

    if (stats.loading) return <Loading />;
    if (stats.error) return <ErrorBox message={stats.error} onRetry={stats.reload} />;

    const s = stats.data!;
    const cards: { label: string; value: number; to?: string; warn?: boolean }[] = [
        { label: 'Users', value: s.totalUsers, to: '/users' },
        { label: 'Open positions', value: s.totalPositions, to: '/positions' },
        { label: 'Pending reviews', value: s.pendingReviews, to: '/reviews', warn: s.pendingReviews > 0 },
        { label: 'Brokers', value: s.totalBrokers, to: '/brokers' },
        { label: 'Communities', value: s.totalCommunities, to: '/communities' },
        { label: 'Promoted symbols', value: s.totalPromoted, to: '/symbols' },
    ];

    return (
        <>
            <div className="grid stats" style={{ marginBottom: 24 }}>
                {cards.map(c => (
                    <Link key={c.label} to={c.to || '#'} className="card stat" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div className="label">{c.label}</div>
                        <div className="value" style={c.warn ? { color: 'var(--warning)' } : undefined}>{c.value}</div>
                    </Link>
                ))}
            </div>

            <div className="card">
                <div className="row between" style={{ marginBottom: 12 }}>
                    <strong>Recent admin activity</strong>
                    <Link to="/audit">View all</Link>
                </div>

                {audit.loading ? <Loading /> : !audit.data?.length ? (
                    <p className="muted" style={{ margin: 0 }}>
                        Nothing recorded yet. Every change made from this console is logged here.
                    </p>
                ) : (
                    <table>
                        <tbody>
                            {audit.data.map(e => (
                                <tr key={e.id}>
                                    <td style={{ width: 1, whiteSpace: 'nowrap' }} className="muted">{ago(e.createdAt)}</td>
                                    <td>{e.summary}</td>
                                    <td style={{ width: 1, whiteSpace: 'nowrap' }} className="muted">{e.actorUsername || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </>
    );
}
