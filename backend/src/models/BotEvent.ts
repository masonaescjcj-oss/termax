/**
 * Bot event — the audit trail behind "why did my bot stop?".
 */

import { supabase } from '../config/supabase';

export interface BotEventRow {
    id: string;
    userId: string;
    botId: string;
    kind: string;
    severity: 'INFO' | 'WARN' | 'ALERT';
    messageFa: string;
    messageEn: string;
    evidence: Record<string, any>;
    createdAt: Date;
}

const toCamel = (db: any): BotEventRow => ({
    id: db.id,
    userId: db.user_id,
    botId: db.bot_id,
    kind: db.kind,
    severity: db.severity,
    messageFa: db.message_fa,
    messageEn: db.message_en,
    evidence: db.evidence ?? {},
    createdAt: new Date(db.created_at),
});

export const BotEvent = {
    async record(userId: string, botId: string, e: {
        kind: string;
        severity?: 'INFO' | 'WARN' | 'ALERT';
        messageFa: string;
        messageEn: string;
        evidence?: Record<string, any>;
    }): Promise<void> {
        const { error } = await supabase.from('bot_events').insert({
            user_id: userId, bot_id: botId,
            kind: e.kind, severity: e.severity ?? 'WARN',
            message_fa: e.messageFa, message_en: e.messageEn,
            evidence: e.evidence ?? {},
        });
        if (error) console.warn('[BotEvent] write failed:', error.message);
    },

    async listByBot(botId: string, limit = 20): Promise<BotEventRow[]> {
        const { data, error } = await supabase
            .from('bot_events').select('*')
            .eq('bot_id', botId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw new Error(error.message);
        return (data ?? []).map(toCamel);
    },

    async listByUser(userId: string, limit = 30): Promise<BotEventRow[]> {
        const { data, error } = await supabase
            .from('bot_events').select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw new Error(error.message);
        return (data ?? []).map(toCamel);
    },
};

export default BotEvent;
