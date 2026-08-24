/**
 * Trade note — the trader's own words on one closed trade.
 *
 * The journal writes itself from the numbers; this is the part only the
 * person can add. Kept in its own table rather than a column on
 * positions so a note survives independently and can be listed on its
 * own ("show me every trade I called greedy").
 */

import { supabase } from '../config/supabase';

export const EMOTIONS = ['confident', 'disciplined', 'anxious', 'fearful', 'greedy', 'bored'] as const;
export type Emotion = typeof EMOTIONS[number];

export const EMOTION_FA: Record<Emotion, string> = {
    confident: 'با اعتماد',
    disciplined: 'منظم',
    anxious: 'مضطرب',
    fearful: 'ترسیده',
    greedy: 'طمع‌کار',
    bored: 'بی‌حوصله',
};

export interface TradeNoteRow {
    id: string;
    userId: string;
    positionId: string;
    note: string;
    emotion: Emotion | null;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

const toCamel = (db: any): TradeNoteRow => ({
    id: db.id,
    userId: db.user_id,
    positionId: db.position_id,
    note: db.note ?? '',
    emotion: db.emotion ?? null,
    tags: Array.isArray(db.tags) ? db.tags : [],
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
});

export const TradeNote = {
    /** Create or replace this user's note on this trade. */
    async upsert(userId: string, positionId: string, patch: {
        note?: string; emotion?: Emotion | null; tags?: string[];
    }): Promise<TradeNoteRow> {
        const { data, error } = await supabase
            .from('trade_notes')
            .upsert({
                user_id: userId,
                position_id: positionId,
                note: (patch.note ?? '').slice(0, 4000),
                emotion: patch.emotion ?? null,
                tags: (patch.tags ?? []).slice(0, 12),
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,position_id' })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return toCamel(data);
    },

    async listByPositions(userId: string, positionIds: string[]): Promise<Map<string, TradeNoteRow>> {
        if (!positionIds.length) return new Map();
        const { data, error } = await supabase
            .from('trade_notes').select('*')
            .eq('user_id', userId)
            .in('position_id', positionIds);
        if (error) throw new Error(error.message);
        return new Map((data ?? []).map(toCamel).map(n => [n.positionId, n]));
    },

    async listByUser(userId: string, limit = 200): Promise<TradeNoteRow[]> {
        const { data, error } = await supabase
            .from('trade_notes').select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(limit);
        if (error) throw new Error(error.message);
        return (data ?? []).map(toCamel);
    },

    async remove(userId: string, positionId: string): Promise<void> {
        const { error } = await supabase
            .from('trade_notes').delete()
            .eq('user_id', userId).eq('position_id', positionId);
        if (error) throw new Error(error.message);
    },
};

export default TradeNote;
