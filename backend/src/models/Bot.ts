/**
 * Bot record — a saved StrategySpec plus its run state. Follows the same
 * thin Supabase-wrapper pattern as models/Position.ts.
 */

import { supabase } from '../config/supabase';
import { initialBotState, BotState, StrategySpec } from '../services/strategy/types';

export type BotStatus = 'STOPPED' | 'FORWARD_TEST' | 'LIVE';

export interface BotRow {
    id: string;
    userId: string;
    accountId: string;
    name: string;
    spec: StrategySpec;
    status: BotStatus;
    runState: BotState;
    /** How live orders are sized: 'MIN' = instrument minimum, 'SPEC' = the spec's sizing. */
    liveVolumeMode: 'MIN' | 'SPEC';
    startedAt: Date | null;
    liveStartedAt: Date | null;
    stoppedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

function toCamel(db: any): BotRow {
    return {
        id: db.id,
        userId: db.user_id,
        accountId: db.account_id,
        name: db.name,
        spec: db.spec,
        status: db.status,
        runState: db.run_state && Object.keys(db.run_state).length
            ? db.run_state
            : initialBotState(),
        liveVolumeMode: db.live_volume_mode === 'SPEC' ? 'SPEC' : 'MIN',
        startedAt: db.started_at ? new Date(db.started_at) : null,
        liveStartedAt: db.live_started_at ? new Date(db.live_started_at) : null,
        stoppedAt: db.stopped_at ? new Date(db.stopped_at) : null,
        createdAt: new Date(db.created_at),
        updatedAt: new Date(db.updated_at),
    };
}

export const Bot = {
    async create(userId: string, accountId: string, name: string, spec: StrategySpec): Promise<BotRow> {
        const { data, error } = await supabase
            .from('bots')
            .insert({ user_id: userId, account_id: accountId, name, spec, run_state: initialBotState() })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return toCamel(data);
    },

    async findById(id: string): Promise<BotRow | null> {
        const { data, error } = await supabase.from('bots').select('*').eq('id', id).maybeSingle();
        if (error) throw new Error(error.message);
        return data ? toCamel(data) : null;
    },

    async listByUser(userId: string): Promise<BotRow[]> {
        const { data, error } = await supabase
            .from('bots').select('*').eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        return (data ?? []).map(toCamel);
    },

    /** Every bot that should be running — loaded by the runner at boot. */
    async listActive(): Promise<BotRow[]> {
        const { data, error } = await supabase.from('bots').select('*').in('status', ['FORWARD_TEST', 'LIVE']);
        if (error) throw new Error(error.message);
        return (data ?? []).map(toCamel);
    },

    async setStatus(id: string, status: BotStatus): Promise<void> {
        const patch: any = { status, updated_at: new Date().toISOString() };
        if (status === 'FORWARD_TEST') patch.started_at = new Date().toISOString();
        if (status === 'STOPPED') patch.stopped_at = new Date().toISOString();
        const { error } = await supabase.from('bots').update(patch).eq('id', id);
        if (error) throw new Error(error.message);
    },

    /** Promote a gated bot onto a live account. */
    async goLive(id: string, liveAccountId: string, volumeMode: 'MIN' | 'SPEC'): Promise<void> {
        const { error } = await supabase.from('bots').update({
            status: 'LIVE',
            account_id: liveAccountId,
            live_volume_mode: volumeMode,
            live_started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }).eq('id', id);
        if (error) throw new Error(error.message);
    },

    /**
     * Persist the interpreter's counters so a restart resumes daily limits
     * and cooldowns instead of resetting them.
     */
    async saveRunState(id: string, runState: BotState): Promise<void> {
        const { error } = await supabase
            .from('bots')
            .update({ run_state: runState, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw new Error(error.message);
    },

    async remove(id: string, userId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('bots').delete().eq('id', id).eq('user_id', userId).select('id');
        if (error) throw new Error(error.message);
        return !!(data && data.length);
    },
};

export default Bot;
