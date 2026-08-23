/**
 * ACCOUNT RISK GUARD — the trader's own daily loss limit.
 *
 * The bot watchdog stops bots; this stops the person. A trader who has
 * lost their daily budget is the worst-positioned human on earth to
 * decide whether to keep trading, so the limit is set in advance, in
 * calm, and enforced by the server.
 *
 * Rules that keep it honest:
 *  - It blocks NEW orders only. Open positions keep their SL/TP; nothing
 *    is force-closed, because a forced close at a random moment is its
 *    own kind of loss.
 *  - It unlocks by itself at the next UTC day. No "just this once"
 *    button to click while tilted — turning the guard off is a settings
 *    change, and the app records it.
 *  - Realised P/L only: an open position swinging red does not lock the
 *    account, otherwise noise would.
 */

export interface RiskGuardConfig {
    enabled: boolean;
    /** Lock when today's realised loss reaches this % of the account. 0 = off. */
    maxDailyLossPct: number;
    /** Lock after this many losing trades today. 0 = off. */
    maxDailyLosses: number;
}

export const DEFAULT_RISK_GUARD: RiskGuardConfig = {
    enabled: false,          // opt-in: it refuses orders, so nobody gets it by surprise
    maxDailyLossPct: 3,
    maxDailyLosses: 0,
};

export function riskGuardConfig(raw: any): RiskGuardConfig {
    const c = raw && typeof raw === 'object' ? raw : {};
    const num = (v: any, fallback: number) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? n : fallback;
    };
    return {
        enabled: !!c.enabled,
        maxDailyLossPct: num(c.maxDailyLossPct, DEFAULT_RISK_GUARD.maxDailyLossPct),
        maxDailyLosses: Math.floor(num(c.maxDailyLosses, DEFAULT_RISK_GUARD.maxDailyLosses)),
    };
}

export interface RiskGuardState {
    locked: boolean;
    reason?: 'dailyLoss' | 'dailyLosses';
    fa: string;
    en: string;
    /** UTC midnight when the lock lifts. */
    unlocksAt: number;
    readings: {
        todayRealised: number;
        todayLosses: number;
        todayTrades: number;
        limitMoney: number | null;
    };
}

export interface ClosedTradeLike {
    finalProfit?: number | null;
    closeTime?: Date | string | null;
}

const money = (v: number) => `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`;

export function evaluateRiskGuard(
    cfg: RiskGuardConfig,
    closedToday: ClosedTradeLike[],
    equity: number,
    now = Date.now()
): RiskGuardState {
    const dayKey = new Date(now).toISOString().slice(0, 10);
    const rows = closedToday
        .filter(t => t.closeTime && new Date(t.closeTime).toISOString().slice(0, 10) === dayKey)
        .map(t => Number(t.finalProfit ?? 0));

    const todayRealised = rows.reduce((s, v) => s + v, 0);
    const todayLosses = rows.filter(v => v < 0).length;
    const limitMoney = cfg.maxDailyLossPct > 0 && equity > 0
        ? -(equity * cfg.maxDailyLossPct / 100)
        : null;

    const unlocksAt = Date.parse(`${dayKey}T00:00:00Z`) + 86_400_000;
    const readings = {
        todayRealised: Number(todayRealised.toFixed(2)),
        todayLosses,
        todayTrades: rows.length,
        limitMoney: limitMoney === null ? null : Number(limitMoney.toFixed(2)),
    };

    if (!cfg.enabled) {
        return { locked: false, fa: 'محافظ ریسک خاموش است.', en: 'The risk guard is off.', unlocksAt, readings };
    }

    if (limitMoney !== null && todayRealised <= limitMoney) {
        return {
            locked: true, reason: 'dailyLoss',
            fa: `ضرر امروز شما ${money(todayRealised)} شد و به سقف ${cfg.maxDailyLossPct}٪ حساب (${money(limitMoney)}) رسید. حساب تا فردا برای سفارش جدید قفل است؛ پوزیشن‌های باز با حد ضرر خودشان می‌مانند.`,
            en: `You are down ${money(todayRealised)} today, at your ${cfg.maxDailyLossPct}% daily limit (${money(limitMoney)}). New orders are locked until tomorrow; open positions keep their stops.`,
            unlocksAt, readings,
        };
    }

    if (cfg.maxDailyLosses > 0 && todayLosses >= cfg.maxDailyLosses) {
        return {
            locked: true, reason: 'dailyLosses',
            fa: `${todayLosses} معامله‌ی ضررده امروز (سقف ${cfg.maxDailyLosses}). حساب تا فردا برای سفارش جدید قفل است.`,
            en: `${todayLosses} losing trades today (limit ${cfg.maxDailyLosses}). New orders are locked until tomorrow.`,
            unlocksAt, readings,
        };
    }

    return { locked: false, fa: 'در محدوده‌ی مجاز.', en: 'Within your limits.', unlocksAt, readings };
}
