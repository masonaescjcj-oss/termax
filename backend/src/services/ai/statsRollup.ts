/**
 * TRADE STATS ROLLUP — updated when a trade closes, read when anyone asks.
 *
 * The AI's get_trade_stats answers from these per-day rows: 30 days = 30
 * tiny rows, whatever the user's lifetime trade count. Aggregating full
 * position history per question is exactly the per-question cost the
 * architecture doc bans.
 */

import { supabase } from '../../config/supabase';

export async function recordClosedTrade(
    userId: string,
    accountId: string,
    netProfit: number,
    closeTime: Date = new Date()
): Promise<void> {
    try {
        const day = closeTime.toISOString().slice(0, 10);
        const { data } = await supabase
            .from('trade_stats_daily').select('*')
            .eq('user_id', userId).eq('account_id', accountId).eq('day', day)
            .maybeSingle();

        const row = {
            user_id: userId,
            account_id: accountId,
            day,
            trades: (data?.trades ?? 0) + 1,
            wins: (data?.wins ?? 0) + (netProfit > 0 ? 1 : 0),
            losses: (data?.losses ?? 0) + (netProfit > 0 ? 0 : 1),
            gross_profit: (data?.gross_profit ?? 0) + Math.max(0, netProfit),
            gross_loss: (data?.gross_loss ?? 0) + Math.max(0, -netProfit),
            net_profit: (data?.net_profit ?? 0) + netProfit,
        };
        const { error } = await supabase
            .from('trade_stats_daily')
            .upsert(row, { onConflict: 'user_id,account_id,day' });
        if (error) console.warn('[Stats] Rollup write failed:', error.message);
    } catch (e: any) {
        console.warn('[Stats] Rollup failed:', e.message);
    }
}

export interface RolledStats {
    days: number;
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    netProfit: number;
    grossProfit: number;
    grossLoss: number;
    profitFactor: number | null;
    expectancy: number;
    /** Per-day series, oldest first, for charts. */
    daily: Array<{ day: string; trades: number; netProfit: number }>;
}

export async function getTradeStats(userId: string, days = 30, accountId?: string): Promise<RolledStats> {
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    let q = supabase
        .from('trade_stats_daily').select('*')
        .eq('user_id', userId).gte('day', since)
        .order('day', { ascending: true });
    if (accountId) q = q.eq('account_id', accountId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const sum = (f: (r: any) => number) => rows.reduce((s, r) => s + f(r), 0);
    const trades = sum(r => r.trades);
    const wins = sum(r => r.wins);
    const grossProfit = sum(r => r.gross_profit);
    const grossLoss = sum(r => r.gross_loss);
    const netProfit = sum(r => r.net_profit);
    return {
        days,
        trades,
        wins,
        losses: trades - wins,
        winRate: trades ? (wins / trades) * 100 : 0,
        netProfit,
        grossProfit,
        grossLoss,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? null : 0),
        expectancy: trades ? netProfit / trades : 0,
        daily: rows.map(r => ({ day: r.day, trades: r.trades, netProfit: r.net_profit })),
    };
}
