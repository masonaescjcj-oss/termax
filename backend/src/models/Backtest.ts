/**
 * Backtest record — same thin Supabase-wrapper pattern as models/Bot.ts.
 * `summary` is what lists ship; `result` is fetched only for the detail view.
 */

import { supabase } from '../config/supabase';
import { StrategySpec } from '../services/strategy/types';

export type BacktestStatus = 'RUNNING' | 'DONE' | 'FAILED';

export interface BacktestRow {
    id: string;
    userId: string;
    botId: string | null;
    name: string;
    spec: StrategySpec;
    fromTs: Date;
    toTs: Date;
    status: BacktestStatus;
    summary: any | null;
    result: any | null;
    error: string | null;
    createdAt: Date;
    finishedAt: Date | null;
}

function toCamel(db: any): BacktestRow {
    return {
        id: db.id,
        userId: db.user_id,
        botId: db.bot_id ?? null,
        name: db.name,
        spec: db.spec,
        fromTs: new Date(db.from_ts),
        toTs: new Date(db.to_ts),
        status: db.status,
        summary: db.summary ?? null,
        result: db.result ?? null,
        error: db.error ?? null,
        createdAt: new Date(db.created_at),
        finishedAt: db.finished_at ? new Date(db.finished_at) : null,
    };
}

export const Backtest = {
    async create(userId: string, name: string, spec: StrategySpec, fromMs: number, toMs: number, botId: string | null): Promise<BacktestRow> {
        const { data, error } = await supabase
            .from('backtests')
            .insert({
                user_id: userId, bot_id: botId, name, spec,
                from_ts: new Date(fromMs).toISOString(),
                to_ts: new Date(toMs).toISOString(),
            })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return toCamel(data);
    },

    async findById(id: string): Promise<BacktestRow | null> {
        const { data, error } = await supabase.from('backtests').select('*').eq('id', id).maybeSingle();
        if (error) throw new Error(error.message);
        return data ? toCamel(data) : null;
    },

    /** List without the heavy `result` column. */
    async listByUser(userId: string, limit = 50): Promise<BacktestRow[]> {
        const { data, error } = await supabase
            .from('backtests')
            .select('id, user_id, bot_id, name, spec, from_ts, to_ts, status, summary, error, created_at, finished_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw new Error(error.message);
        return (data ?? []).map(d => toCamel({ ...d, result: null }));
    },

    async countByUser(userId: string): Promise<number> {
        const { count, error } = await supabase
            .from('backtests').select('id', { count: 'exact', head: true }).eq('user_id', userId);
        if (error) throw new Error(error.message);
        return count ?? 0;
    },

    async finish(id: string, summary: any, result: any): Promise<void> {
        const { error } = await supabase.from('backtests').update({
            status: 'DONE', summary, result, finished_at: new Date().toISOString(),
        }).eq('id', id);
        if (error) throw new Error(error.message);
    },

    async fail(id: string, message: string): Promise<void> {
        const { error } = await supabase.from('backtests').update({
            status: 'FAILED', error: message.slice(0, 500), finished_at: new Date().toISOString(),
        }).eq('id', id);
        if (error) throw new Error(error.message);
    },

    async remove(id: string, userId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('backtests').delete().eq('id', id).eq('user_id', userId).select('id');
        if (error) throw new Error(error.message);
        return !!(data && data.length);
    },
};

export default Backtest;
