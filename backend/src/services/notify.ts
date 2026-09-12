/**
 * One call to tell the trader something, on every channel they have:
 *
 *   - the inbox row (so it is there when they open the app later),
 *   - the open terminal or app (socket, room `user:<id>`),
 *   - Telegram, through the bot the app already runs, if the account is
 *     linked to a Telegram id,
 *   - Expo push, if a device registered a token.
 *
 * Delivery is best-effort per channel: a Telegram outage must never stop
 * the inbox row, and nothing here may throw into the trade engine.
 */
import User from '../models/User';
import { Notification, NotificationKind, PushToken } from '../models/Notification';
import { emitPositionUpdate } from '../sockets/tradeSocket';
import { sendTelegramMessage } from '../bot';

export interface Notice {
    kind: NotificationKind;
    title: string;
    body?: string;
    data?: Record<string, any>;
    /** Skip Telegram/push for low-value events; the inbox and socket still get it. */
    quiet?: boolean;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function pushExpo(tokens: string[], title: string, body: string, data: Record<string, any>) {
    if (!tokens.length) return;
    try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(tokens.map(to => ({ to, title, body, data, sound: 'default' }))),
        });
        if (!res.ok) console.warn('[notify] Expo push answered', res.status);
    } catch (e: any) {
        console.warn('[notify] Expo push failed:', e.message);
    }
}

export async function notify(userId: string, notice: Notice): Promise<void> {
    if (!userId) return;
    const body = notice.body ?? '';
    const data = notice.data ?? {};

    const row = await Notification.create(userId, { kind: notice.kind, title: notice.title, body, data }).catch(() => null);

    emitPositionUpdate(userId, 'notification', row ?? { kind: notice.kind, title: notice.title, body, data, createdAt: new Date() });

    if (notice.quiet) return;

    try {
        const user = await User.findById(userId);
        const tg = user?.telegramId;
        if (tg) {
            void sendTelegramMessage(String(tg), `<b>${escapeHtml(notice.title)}</b>${body ? `\n${escapeHtml(body)}` : ''}`);
        }
        const tokens = await PushToken.forUser(userId);
        void pushExpo(tokens, notice.title, body, data);
    } catch (e: any) {
        console.warn('[notify] delivery failed:', e.message);
    }
}
