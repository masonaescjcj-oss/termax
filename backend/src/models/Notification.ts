/**
 * The notification inbox: one row per thing the trader should know about.
 */
import { supabase } from '../config/supabase';

export type NotificationKind = 'price_alert' | 'position' | 'margin' | 'bot' | 'system';

export interface NotificationRow {
    id: string;
    userId: string;
    kind: NotificationKind;
    title: string;
    body: string;
    data: Record<string, any>;
    readAt: Date | null;
    createdAt: Date;
}

const toCamel = (db: any): NotificationRow => ({
    id: db.id, userId: db.user_id, kind: db.kind, title: db.title, body: db.body ?? '',
    data: db.data ?? {}, readAt: db.read_at ? new Date(db.read_at) : null, createdAt: new Date(db.created_at),
});

export const Notification = {
    async create(userId: string, n: { kind: NotificationKind; title: string; body?: string; data?: Record<string, any> }): Promise<NotificationRow | null> {
        const { data, error } = await supabase.from('notifications')
            .insert({ user_id: userId, kind: n.kind, title: n.title, body: n.body ?? '', data: n.data ?? {} })
            .select().single();
        if (error) { console.warn('[Notification] write failed:', error.message); return null; }
        return toCamel(data);
    },

    async list(userId: string, opts: { limit?: number; unreadOnly?: boolean } = {}): Promise<NotificationRow[]> {
        let q = supabase.from('notifications').select('*').eq('user_id', userId)
            .order('created_at', { ascending: false }).limit(Math.min(200, opts.limit ?? 50));
        if (opts.unreadOnly) q = q.is('read_at', null);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return (data ?? []).map(toCamel);
    },

    async unreadCount(userId: string): Promise<number> {
        const { count, error } = await supabase.from('notifications')
            .select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null);
        if (error) throw new Error(error.message);
        return count ?? 0;
    },

    async markRead(userId: string, ids: string[] | 'all'): Promise<void> {
        let q = supabase.from('notifications').update({ read_at: new Date().toISOString() })
            .eq('user_id', userId).is('read_at', null);
        if (ids !== 'all') q = q.in('id', ids);
        const { error } = await q;
        if (error) throw new Error(error.message);
    },
};

export const PushToken = {
    async register(userId: string, token: string, platform = 'expo'): Promise<void> {
        const { error } = await supabase.from('push_tokens').upsert({ user_id: userId, token, platform }, { onConflict: 'user_id,token' });
        if (error) throw new Error(error.message);
    },
    async remove(userId: string, token: string): Promise<void> {
        const { error } = await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
        if (error) throw new Error(error.message);
    },
    async forUser(userId: string): Promise<string[]> {
        const { data, error } = await supabase.from('push_tokens').select('token').eq('user_id', userId);
        if (error) return [];
        return (data ?? []).map((r: any) => r.token);
    },
};
