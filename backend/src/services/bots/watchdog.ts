/**
 * BOT WATCHDOG — the safety net that can only ever STOP a bot.
 *
 * A bot that worked can quietly stop working: the market's regime turns
 * and the edge evaporates while the bot keeps placing orders. Nothing in
 * the app noticed that until now. The watchdog notices, in four
 * deterministic ways, and either pauses the bot or just says so —
 * the user's choice, per bot, with an explicit on/off switch.
 *
 * Design rules:
 *  - It NEVER opens a trade and never touches an open position. Worst
 *    case it stops new entries; SL/TP still protect what is open.
 *  - Every trip carries the numbers that caused it, in both languages,
 *    rendered from the evidence (same rule as Trade DNA).
 *  - Counted, not modelled: no AI tokens, no statistics the user cannot
 *    check by hand.
 */

import { TradeStats, TradeLike } from './tradeStats';

export interface WatchdogConfig {
    /** Master switch. Off = the watchdog is silent and never intervenes. */
    enabled: boolean;
    /** PAUSE stops the bot on a trip; ALERT only records the event. */
    action: 'PAUSE' | 'ALERT';
    /** Stop after losing this % of the account in one UTC day. 0 = off. */
    maxDailyLossPct: number;
    /** Stop after this many losing trades in a row. 0 = off. */
    maxConsecutiveLosses: number;
    /** Stop when the bot's own equity curve falls this % from its peak. 0 = off. */
    maxDrawdownPct: number;
    /** Watch for a decayed edge (recent expectancy vs the bot's baseline). */
    edgeDecay: boolean;
}

export const DEFAULT_WATCHDOG: WatchdogConfig = {
    enabled: true,
    action: 'PAUSE',
    maxDailyLossPct: 5,
    maxConsecutiveLosses: 5,
    maxDrawdownPct: 15,
    edgeDecay: true,
};

/** Trades needed on each side before an edge comparison means anything. */
export const EDGE_WINDOW = 15;
const EDGE_TRIP_RATIO = 0.3;

export type WatchdogKey = 'dailyLoss' | 'consecutiveLosses' | 'drawdown' | 'edgeDecay';

export interface WatchdogVerdict {
    tripped: boolean;
    key?: WatchdogKey;
    severity: 'INFO' | 'WARN' | 'ALERT';
    fa: string;
    en: string;
    evidence: Record<string, number | string>;
    /** Everything the UI needs to draw the gauges, trip or no trip. */
    readings: {
        todayNet: number;
        consecutiveLosses: number;
        drawdown: number;
        drawdownPct: number;
        baselineExpectancy: number | null;
        recentExpectancy: number | null;
        edgeRatio: number | null;
        trades: number;
    };
}

/** Merge a stored (possibly partial) config over the defaults. */
export function watchdogConfig(raw: any): WatchdogConfig {
    const c = raw && typeof raw === 'object' ? raw : {};
    const num = (v: any, fallback: number) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? n : fallback;
    };
    return {
        enabled: c.enabled === undefined ? DEFAULT_WATCHDOG.enabled : !!c.enabled,
        action: c.action === 'ALERT' ? 'ALERT' : 'PAUSE',
        maxDailyLossPct: num(c.maxDailyLossPct, DEFAULT_WATCHDOG.maxDailyLossPct),
        maxConsecutiveLosses: Math.floor(num(c.maxConsecutiveLosses, DEFAULT_WATCHDOG.maxConsecutiveLosses)),
        maxDrawdownPct: num(c.maxDrawdownPct, DEFAULT_WATCHDOG.maxDrawdownPct),
        edgeDecay: c.edgeDecay === undefined ? DEFAULT_WATCHDOG.edgeDecay : !!c.edgeDecay,
    };
}

const money = (v: number) => `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`;

/**
 * Evaluate the bot's own closed trades against its limits.
 *
 * `equityBase` is the account size the percentages are measured against —
 * the caller passes the account's current equity, so a 5% daily limit
 * means 5% of what the user actually has, not of some historical number.
 */
export function evaluateWatchdog(
    cfg: WatchdogConfig,
    trades: TradeLike[],
    equityBase: number,
    now = Date.now()
): WatchdogVerdict {
    const rows = trades
        .map(t => ({
            net: Number(t.finalProfit ?? 0),
            closeMs: t.closeTime ? new Date(t.closeTime).getTime() : NaN,
        }))
        .filter(r => Number.isFinite(r.closeMs))
        .sort((a, b) => a.closeMs - b.closeMs);

    // ── readings (always computed, so the UI can show gauges) ───────
    const dayKey = new Date(now).toISOString().slice(0, 10);
    const todayNet = rows
        .filter(r => new Date(r.closeMs).toISOString().slice(0, 10) === dayKey)
        .reduce((s, r) => s + r.net, 0);

    let consecutiveLosses = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].net < 0) consecutiveLosses++;
        else break;
    }

    let cum = 0;
    let peak = 0;
    let drawdown = 0;
    for (const r of rows) {
        cum += r.net;
        if (cum > peak) peak = cum;
        if (peak - cum > drawdown) drawdown = peak - cum;
    }
    const drawdownPct = equityBase > 0 ? (drawdown / equityBase) * 100 : 0;

    let baselineExpectancy: number | null = null;
    let recentExpectancy: number | null = null;
    let edgeRatio: number | null = null;
    if (rows.length >= EDGE_WINDOW * 2) {
        const baseline = rows.slice(0, EDGE_WINDOW);
        const recent = rows.slice(-EDGE_WINDOW);
        baselineExpectancy = baseline.reduce((s, r) => s + r.net, 0) / baseline.length;
        recentExpectancy = recent.reduce((s, r) => s + r.net, 0) / recent.length;
        if (baselineExpectancy > 0) edgeRatio = recentExpectancy / baselineExpectancy;
    }

    const readings = {
        todayNet: Number(todayNet.toFixed(2)),
        consecutiveLosses,
        drawdown: Number(drawdown.toFixed(2)),
        drawdownPct: Number(drawdownPct.toFixed(2)),
        baselineExpectancy: baselineExpectancy === null ? null : Number(baselineExpectancy.toFixed(2)),
        recentExpectancy: recentExpectancy === null ? null : Number(recentExpectancy.toFixed(2)),
        edgeRatio: edgeRatio === null ? null : Number(edgeRatio.toFixed(2)),
        trades: rows.length,
    };

    const quiet = (): WatchdogVerdict => ({
        tripped: false, severity: 'INFO',
        fa: 'همه‌ی حدها رعایت شده.', en: 'All limits within range.',
        evidence: {}, readings,
    });

    if (!cfg.enabled) {
        return {
            tripped: false, severity: 'INFO',
            fa: 'نگهبان خاموش است.', en: 'The watchdog is off.',
            evidence: {}, readings,
        };
    }

    // ── trips, most urgent first ────────────────────────────────────
    const dailyLimit = cfg.maxDailyLossPct > 0 && equityBase > 0
        ? -(equityBase * cfg.maxDailyLossPct / 100)
        : null;
    if (dailyLimit !== null && todayNet <= dailyLimit) {
        return {
            tripped: true, key: 'dailyLoss', severity: 'ALERT',
            fa: `ضرر امروز این ربات ${money(todayNet)} شد و از سقف ${cfg.maxDailyLossPct}٪ حساب (${money(dailyLimit)}) گذشت.`,
            en: `The bot lost ${money(todayNet)} today, past its ${cfg.maxDailyLossPct}% daily limit (${money(dailyLimit)}).`,
            evidence: { todayNet: readings.todayNet, limit: Number(dailyLimit.toFixed(2)), maxDailyLossPct: cfg.maxDailyLossPct },
            readings,
        };
    }

    if (cfg.maxConsecutiveLosses > 0 && consecutiveLosses >= cfg.maxConsecutiveLosses) {
        return {
            tripped: true, key: 'consecutiveLosses', severity: 'ALERT',
            fa: `${consecutiveLosses} ضرر پشت‌سرهم (سقف ${cfg.maxConsecutiveLosses}). بازار ممکن است دیگر با این استراتژی نخواند.`,
            en: `${consecutiveLosses} losses in a row (limit ${cfg.maxConsecutiveLosses}). The market may no longer fit this strategy.`,
            evidence: { consecutiveLosses, limit: cfg.maxConsecutiveLosses },
            readings,
        };
    }

    if (cfg.maxDrawdownPct > 0 && drawdownPct >= cfg.maxDrawdownPct) {
        return {
            tripped: true, key: 'drawdown', severity: 'ALERT',
            fa: `افت سرمایه‌ی این ربات به ${drawdownPct.toFixed(1)}٪ حساب رسید (${money(drawdown)}) و از سقف ${cfg.maxDrawdownPct}٪ گذشت.`,
            en: `The bot's drawdown reached ${drawdownPct.toFixed(1)}% of the account (${money(drawdown)}), past its ${cfg.maxDrawdownPct}% limit.`,
            evidence: { drawdown: readings.drawdown, drawdownPct: readings.drawdownPct, limit: cfg.maxDrawdownPct },
            readings,
        };
    }

    if (cfg.edgeDecay && edgeRatio !== null && edgeRatio <= EDGE_TRIP_RATIO) {
        return {
            tripped: true, key: 'edgeDecay', severity: 'ALERT',
            fa: `لبه‌ی ربات افت کرده: انتظار ریاضی ${EDGE_WINDOW} معامله‌ی آخر ${money(recentExpectancy!)} در برابر ${money(baselineExpectancy!)} در شروع — ${(edgeRatio * 100).toFixed(0)}٪ باقی مانده.`,
            en: `The bot's edge decayed: expectancy over the last ${EDGE_WINDOW} trades is ${money(recentExpectancy!)} versus ${money(baselineExpectancy!)} at the start — ${(edgeRatio * 100).toFixed(0)}% left.`,
            evidence: {
                recentExpectancy: readings.recentExpectancy!, baselineExpectancy: readings.baselineExpectancy!,
                edgeRatio: readings.edgeRatio!, window: EDGE_WINDOW,
            },
            readings,
        };
    }

    return quiet();
}
