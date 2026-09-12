import { data } from '../api';
import { Empty, Spinner, useLoader } from '../components/ui';

type Event = { event: string; country: string; impact: string; time: string; actual?: string; forecast?: string; previous?: string };

export function CalendarPanel() {
    const cal = useLoader<Event[]>(() => data('/tools/calendar'), [], { every: 300_000 });
    if (cal.loading && !cal.data) return <div className="panel-body" style={{ display: 'grid', placeItems: 'center' }}><Spinner dark /></div>;
    if (!cal.data?.length) return <div className="panel-body"><Empty title="No upcoming events" text={cal.error || undefined} /></div>;
    const byDay = new Map<string, Event[]>();
    for (const e of cal.data) {
        const d = new Date(e.time);
        const key = Number.isNaN(d.getTime()) ? 'Upcoming' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(e);
    }
    return (
        <div className="panel-body">
            {[...byDay].map(([day, list]) => (
                <div key={day}>
                    <div className="section-title">{day}</div>
                    {list.map((e, i) => {
                        const t = new Date(e.time);
                        return (
                            <div key={i} className="cal-row">
                                <span className="muted num">{Number.isNaN(t.getTime()) ? '—' : t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className={`imp ${e.impact}`} title={`${e.impact} impact`} />
                                <span className="strong" style={{ width: 34 }}>{e.country}</span>
                                <span className="grow ellipsis">{e.event}</span>
                                {e.actual && <span className="num strong">{e.actual}</span>}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
