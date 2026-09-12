/**
 * Price alert rows. Thin Supabase wrapper in the style of models/Bot.ts.
 */
import { supabase } from '../config/supabase';

export type AlertCondition = 'above' | 'below';
export type AlertStatus = 'active' | 'triggered' | 'cancelled';

export interface PriceAlertRow {
    id: string;
    userId: string;
    symbol: string;
    price: number;
    condition: AlertCondition;
    note: string | null;
    status: AlertStatus;
    triggeredAt: Date | null;
    triggeredPrice: number | null;
    createdAt: Date;
}

const toCamel = (db: any): PriceAlertRow => ({
    id: db.id,
    userId: db.user_id,
    symbol: db.symbol,
    price: Number(db.price),
    condition: db.condition,
    note: db.note ?? null,
    status: db.status,
    triggeredAt: db.triggered_at ? new Date(db.triggered_at) : null,
    triggeredPrice: db.triggered_price == null ? null : Number(db.triggered_price),
    createdAt: new Date(db.created_at),
});

export const PriceAlert = {
    async create(userId: string, a: { symbol: string; price: number; condition: AlertCondition; note?: string | null }): Promise<PriceAlertRow> {
        const { data, error } = await supabase.from('price_alerts')
            .insert({ user_id: userId, symbol: a.symbol, price: a.price, condition: a.condition, note: a.note ?? null })
            .select().single();
        if (error) throw new Error(error.message);
        return toCamel(data);
    },

    async listByUser(userId: string, limit = 100): Promise<PriceAlertRow[]> {
        const { data, error } = await supabase.from('price_alerts').select('*')
            .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
        if (error) throw new Error(error.message);
        return (data ?? []).map(toCamel);
    },

    async listActive(): Promise<PriceAlertRow[]> {
        const { data, error } = await supabase.from('price_alerts').select('*').eq('status', 'active');
        if (error) throw new Error(error.message);
        return (data ?? []).map(toCamel);
    },

    async countActive(userId: string): Promise<number> {
        const { count, error } = await supabase.from('price_alerts')
            .select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active');
        if (error) throw new Error(error.message);
        return count ?? 0;
    },

    /** Marks the alert fired; returns false if another worker got there first. */
    async markTriggered(id: string, price: number): Promise<boolean> {
        const { data, error } = await supabase.from('price_alerts')
            .update({ status: 'triggered', triggered_at: new Date().toISOString(), triggered_price: price })
            .eq('id', id).eq('status', 'active').select('id');
        if (error) throw new Error(error.message);
        return (data ?? []).length > 0;
    },

    async rearm(id: string, userId: string): Promise<PriceAlertRow | null> {
        const { data, error } = await supabase.from('price_alerts')
            .update({ status: 'active', triggered_at: null, triggered_price: null })
            .eq('id', id).eq('user_id', userId).select().maybeSingle();
        if (error) throw new Error(error.message);
        return data ? toCamel(data) : null;
    },

    async remove(id: string, userId: string): Promise<boolean> {
        const { data, error } = await supabase.from('price_alerts').delete().eq('id', id).eq('user_id', userId).select('id');
        if (error) throw new Error(error.message);
        return (data ?? []).length > 0;
    },

    async clearTriggered(userId: string): Promise<number> {
        const { data, error } = await supabase.from('price_alerts').delete()
            .eq('user_id', userId).eq('status', 'triggered').select('id');
        if (error) throw new Error(error.message);
        return (data ?? []).length;
    },
};
