/**
 * AI QUOTA — the daily message counter.
 *
 * On a $25 server the binding cost is AI tokens, not CPU (architecture doc
 * §3): quotas are a launch requirement, not a growth feature. The counter
 * lives in Supabase so restarts cannot reset anyone's day.
 */

import { supabase } from '../../config/supabase';
import { aiDailyLimitFor } from '../plans';

export interface QuotaState {
    allowed: boolean;
    used: number;
    limit: number;
    remaining: number;
    day: string;
}

export function dailyLimitFor(user: any): number {
    return aiDailyLimitFor(user);
}

export const todayKey = (now = new Date()): string => now.toISOString().slice(0, 10);

/** Read today's counter without incrementing. */
export async function getUsage(userId: string, now = new Date()): Promise<{ messages: number; toolCalls: number; day: string }> {
    const day = todayKey(now);
    const { data } = await supabase
        .from('ai_usage').select('messages, tool_calls')
        .eq('user_id', userId).eq('day', day).maybeSingle();
    return { messages: data?.messages ?? 0, toolCalls: data?.tool_calls ?? 0, day };
}

/**
 * Count one message against the quota. Returns the state AFTER counting;
 * when the limit is already spent, nothing is written and allowed=false.
 */
export async function consumeMessage(userId: string, limit: number, now = new Date()): Promise<QuotaState> {
    const day = todayKey(now);
    const current = await getUsage(userId, now);
    if (current.messages >= limit) {
        return { allowed: false, used: current.messages, limit, remaining: 0, day };
    }
    const next = current.messages + 1;
    const { error } = await supabase.from('ai_usage').upsert(
        { user_id: userId, day, messages: next, tool_calls: current.toolCalls },
        { onConflict: 'user_id,day' }
    );
    if (error) {
        // Fail OPEN on infrastructure errors: a broken counter must not
        // silence the product, and the next successful write self-corrects.
        console.warn('[AI] Quota write failed:', error.message);
    }
    return { allowed: true, used: next, limit, remaining: Math.max(0, limit - next), day };
}

/** Add tool calls to today's row — bookkeeping, never blocking. */
export async function recordToolCalls(userId: string, count: number, now = new Date()): Promise<void> {
    if (!(count > 0)) return;
    try {
        const day = todayKey(now);
        const current = await getUsage(userId, now);
        await supabase.from('ai_usage').upsert(
            { user_id: userId, day, messages: current.messages, tool_calls: current.toolCalls + count },
            { onConflict: 'user_id,day' }
        );
    } catch { /* stats only */ }
}
