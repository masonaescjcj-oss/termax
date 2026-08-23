/**
 * Published strategy — a bot in the public library. Thin Supabase wrapper.
 */

import { supabase } from '../config/supabase';
import { StrategySpec } from '../services/strategy/types';

export interface PublishedRow {
    id: string;
    userId: string;
    botId: string;
    title: string;
    description: string | null;
    spec: StrategySpec;
    clones: number;
    isActive: boolean;
    publishedAt: Date;
}

function toCamel(db: any): PublishedRow {
    return {
        id: db.id,
        userId: db.user_id,
        botId: db.bot_id,
        title: db.title,
        description: db.description ?? null,
        spec: db.spec,
        clones: db.clones ?? 0,
        isActive: !!db.is_active,
        publishedAt: new Date(db.published_at),
    };
}

export const PublishedStrategy = {
    async publish(userId: string, botId: string, title: string, description: string | null, spec: StrategySpec): Promise<PublishedRow> {
        const { data, error } = await supabase
            .from('published_strategies')
            .upsert(
                { user_id: userId, bot_id: botId, title, description, spec, is_active: true },
                { onConflict: 'bot_id' }
            )
            .select()
            .single();
        if (error) throw new Error(error.message);
        return toCamel(data);
    },

    async findById(id: string): Promise<PublishedRow | null> {
        const { data, error } = await supabase.from('published_strategies').select('*').eq('id', id).maybeSingle();
        if (error) throw new Error(error.message);
        return data ? toCamel(data) : null;
    },

    async listActive(limit = 50): Promise<PublishedRow[]> {
        const { data, error } = await supabase
            .from('published_strategies').select('*')
            .eq('is_active', true)
            .order('published_at', { ascending: false })
            .limit(limit);
        if (error) throw new Error(error.message);
        return (data ?? []).map(toCamel);
    },

    async unpublish(id: string, userId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('published_strategies')
            .update({ is_active: false })
            .eq('id', id).eq('user_id', userId).select('id');
        if (error) throw new Error(error.message);
        return !!(data && data.length);
    },

    async bumpClones(id: string): Promise<void> {
        const { data } = await supabase.from('published_strategies').select('clones').eq('id', id).maybeSingle();
        await supabase.from('published_strategies')
            .update({ clones: (data?.clones ?? 0) + 1 })
            .eq('id', id);
    },
};

export default PublishedStrategy;
