/**
 * Custom indicator record — thin Supabase wrapper, same pattern as Bot.ts.
 */

import { supabase } from '../config/supabase';

export interface CustomIndicatorRow {
    id: string;
    userId: string;
    name: string;
    expr: string;
    pane: 'price' | 'separate';
    color: string;
    enabled: boolean;
    origin: 'USER' | 'AI' | 'IMPORT' | 'CLONE';
    createdAt: Date;
    updatedAt: Date;
}

function toCamel(db: any): CustomIndicatorRow {
    return {
        id: db.id,
        userId: db.user_id,
        name: db.name,
        expr: db.expr,
        pane: db.pane === 'price' ? 'price' : 'separate',
        color: db.color ?? '#F5A623',
        enabled: !!db.enabled,
        origin: ['AI', 'IMPORT', 'CLONE'].includes(db.origin) ? db.origin : 'USER',
        createdAt: new Date(db.created_at),
        updatedAt: new Date(db.updated_at),
    };
}

export const CustomIndicator = {
    async create(userId: string, fields: { name: string; expr: string; pane: 'price' | 'separate'; color: string; origin?: 'USER' | 'AI' | 'IMPORT' | 'CLONE' }): Promise<CustomIndicatorRow> {
        const { data, error } = await supabase
            .from('custom_indicators')
            .insert({ user_id: userId, name: fields.name, expr: fields.expr, pane: fields.pane, color: fields.color, origin: fields.origin ?? 'USER' })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return toCamel(data);
    },

    async findById(id: string): Promise<CustomIndicatorRow | null> {
        const { data, error } = await supabase.from('custom_indicators').select('*').eq('id', id).maybeSingle();
        if (error) throw new Error(error.message);
        return data ? toCamel(data) : null;
    },

    async listByUser(userId: string, enabledOnly = false): Promise<CustomIndicatorRow[]> {
        let q = supabase.from('custom_indicators').select('*').eq('user_id', userId)
            .order('created_at', { ascending: true });
        if (enabledOnly) q = q.eq('enabled', true);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return (data ?? []).map(toCamel);
    },

    async setEnabled(id: string, userId: string, enabled: boolean): Promise<void> {
        const { error } = await supabase.from('custom_indicators')
            .update({ enabled, updated_at: new Date().toISOString() })
            .eq('id', id).eq('user_id', userId);
        if (error) throw new Error(error.message);
    },

    async remove(id: string, userId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('custom_indicators').delete().eq('id', id).eq('user_id', userId).select('id');
        if (error) throw new Error(error.message);
        return !!(data && data.length);
    },
};

export default CustomIndicator;
