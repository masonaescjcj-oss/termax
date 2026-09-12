/**
 * The notification bell: unread count, a dropdown inbox, and the toast +
 * system notification for anything that arrives while the terminal is open.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notify } from '../alerts';
import { onLiveNotification, useNotifications, type Notice } from '../notifications';
import { Ic } from './icons';
import { ago, useClickOutside, useToast } from './ui';

const ICON: Record<Notice['kind'], string> = { price_alert: '🔔', position: '💹', margin: '⚠️', bot: '🤖', system: 'ℹ️' };

export function Bell() {
    const { items, unread, refresh, markAllRead } = useNotifications();
    const toast = useToast();
    const nav = useNavigate();
    const [open, setOpen] = useState(false);
    const close = useCallback(() => setOpen(false), []);
    const ref = useClickOutside<HTMLDivElement>(open, close);

    useEffect(() => onLiveNotification(n => {
        toast(`${n.title}${n.body ? ` — ${n.body}` : ''}`, n.kind === 'margin' ? 'err' : 'ok');
        void notify(n.title, n.body);
    }), [toast]);

    const toggle = () => {
        setOpen(o => {
            if (!o) { void refresh(); setTimeout(() => void markAllRead(), 1500); }
            return !o;
        });
    };
    const go = (n: Notice) => {
        close();
        const sym = n.data?.symbol;
        if (n.kind === 'bot') nav('/bots');
        else if (sym) nav(`/chart/${encodeURIComponent(String(sym).replace('/', '-'))}`);
    };

    return (
        <div className="menu" ref={ref}>
            <button className="bell" onClick={toggle} aria-label="Notifications" title="Notifications">
                <Ic.bell />
                {unread > 0 && <span className="bell-count">{unread > 99 ? '99+' : unread}</span>}
            </button>
            {open && (
                <div className="menu-pop inbox">
                    <div className="who row" style={{ justifyContent: 'space-between' }}><b style={{ margin: 0 }}>Notifications</b>{items.length > 0 && <button className="link-btn" style={{ width: 'auto', padding: 0 }} onClick={() => void markAllRead()}>Mark all read</button>}</div>
                    {items.length === 0 && <div className="empty" style={{ padding: '18px 12px' }}><b>Nothing yet</b>Alerts, fills, stop-outs and bot events land here.</div>}
                    <div className="inbox-list">
                        {items.slice(0, 30).map((n, i) => (
                            <button key={n.id ?? i} className={`inbox-row ${n.readAt ? '' : 'unread'}`} onClick={() => go(n)}>
                                <span className="ic">{ICON[n.kind] ?? '•'}</span>
                                <span className="grow">
                                    <span className="t">{n.title}</span>
                                    {n.body && <span className="b">{n.body}</span>}
                                </span>
                                <span className="muted small">{ago(n.createdAt)}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
