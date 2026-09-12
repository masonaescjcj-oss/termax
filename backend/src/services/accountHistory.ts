/**
 * DAILY ACCOUNT SNAPSHOTS
 *
 * Once a day, write down what every account was worth. Two queries for
 * the whole platform — all open positions and the day's closed ones —
 * not one per user: the job runs whether or not anyone is trading, so
 * whatever it does unconditionally is paid for every day forever.
 */
import { supabase } from '../config/supabase';
import { mapPositionToCamel } from '../utils/mapper';
import { accountMetrics } from './pricing';
import { SnapshotRow, utcDay } from './equityCurve';

interface Account { accountId: string; balance: number }

/** Realised P/L and trade count per (user, account) for one UTC day. */
export async function realisedOn(day: string): Promise<Map<string, { realised: number; trades: number }>> {
    const from = `${day}T00:00:00.000Z`;
    const to = `${day}T23:59:59.999Z`;
    const out = new Map<string, { realised: number; trades: number }>();
    const { data, error } = await supabase
        .from('positions')
        .select('user_id, account_id, final_profit')
        .eq('status', 'CLOSED')
        .gte('close_time', from)
        .lte('close_time', to);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
        const key = `${row.user_id}|${row.account_id ?? 'default_demo'}`;
        const cur = out.get(key) ?? { realised: 0, trades: 0 };
        cur.realised += Number(row.final_profit) || 0;
        cur.trades += 1;
        out.set(key, cur);
    }
    return out;
}

/**
 * Write one row per account for the given day. Equity is marked against
 * the prices the engine holds right now, which is what makes this a
 * snapshot rather than a reconstruction.
 */
export async function snapshotAll(now: number = Date.now()): Promise<number> {
    const day = utcDay(now);

    const { data: users, error: userErr } = await supabase.from('users').select('id, ctrader_accounts');
    if (userErr) throw new Error(userErr.message);

    const { data: openRows, error: posErr } = await supabase.from('positions').select('*').eq('status', 'OPEN');
    if (posErr) throw new Error(posErr.message);

    const openByAccount = new Map<string, any[]>();
    for (const row of openRows ?? []) {
        const key = `${row.user_id}|${row.account_id ?? 'default_demo'}`;
        if (!openByAccount.has(key)) openByAccount.set(key, []);
        openByAccount.get(key)!.push(mapPositionToCamel(row));
    }

    const realised = await realisedOn(day);

    const rows: any[] = [];
    for (const user of users ?? []) {
        const accounts: Account[] = ((user.ctrader_accounts ?? []) as any[]).map(a => ({
            accountId: a.cTraderId || a.accountId || 'default_demo',
            balance: Number(a.balance) || 0,
        }));
        // An account the trader has not opened yet still has a history the
        // moment they place their first order; until then there is nothing
        // to record.
        if (!accounts.length) continue;

        for (const account of accounts) {
            const key = `${user.id}|${account.accountId}`;
            const positions = openByAccount.get(key) ?? [];
            const r = realised.get(key) ?? { realised: 0, trades: 0 };
            if (!positions.length && !r.trades && account.balance === 0) continue;

            const m = accountMetrics(account.balance, positions as any);
            rows.push({
                user_id: user.id,
                account_id: account.accountId,
                day,
                balance: Number(m.balance.toFixed(2)),
                equity: Number(m.equity.toFixed(2)),
                margin: Number(m.margin.toFixed(2)),
                open_positions: positions.length,
                realised: Number(r.realised.toFixed(2)),
                trades: r.trades,
            });
        }
    }

    for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await supabase.from('account_snapshots').upsert(chunk, { onConflict: 'user_id,account_id,day' });
        if (error) throw new Error(error.message);
    }
    return rows.length;
}

/** Realised P/L and trades for one account on one day — the live "today". */
export async function realisedFor(userId: string, accountId: string, day: string): Promise<{ realised: number; trades: number }> {
    const { data, error } = await supabase
        .from('positions')
        .select('final_profit')
        .eq('user_id', userId)
        .eq('account_id', accountId)
        .eq('status', 'CLOSED')
        .gte('close_time', `${day}T00:00:00.000Z`)
        .lte('close_time', `${day}T23:59:59.999Z`);
    if (error) throw new Error(error.message);
    return {
        realised: Number(((data ?? []).reduce((s, r) => s + (Number(r.final_profit) || 0), 0)).toFixed(2)),
        trades: (data ?? []).length,
    };
}

/** The stored days for one account, oldest first. */
export async function readHistory(userId: string, accountId: string, days = 180): Promise<SnapshotRow[]> {
    const since = utcDay(Date.now() - Math.max(1, Math.min(1000, days)) * 86_400_000);
    const { data, error } = await supabase
        .from('account_snapshots')
        .select('day, balance, equity, realised, trades')
        .eq('user_id', userId)
        .eq('account_id', accountId)
        .gte('day', since)
        .order('day', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(r => ({
        day: String(r.day).slice(0, 10),
        balance: Number(r.balance) || 0,
        equity: Number(r.equity) || 0,
        realised: Number(r.realised) || 0,
        trades: Number(r.trades) || 0,
    }));
}

/**
 * Today's row, computed live rather than read, so the curve ends at the
 * present moment instead of at last midnight. Replaces a stored row for
 * the same day if the job has already run today.
 */
export function withToday(rows: SnapshotRow[], today: SnapshotRow): SnapshotRow[] {
    const rest = rows.filter(r => r.day !== today.day);
    return [...rest, today].sort((a, b) => a.day.localeCompare(b.day));
}
