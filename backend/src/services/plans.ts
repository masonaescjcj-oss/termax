/**
 * PLANS — one table of limits, read everywhere a cap is checked.
 *
 * The quotas were launch requirements (the AI bill is the real cost on
 * this server); the PRO tier is what pays for them. Enforcement reads
 * user.plan; HOW a user becomes PRO (payment gateway) is deliberately
 * outside this file — an admin endpoint flips the column until payments
 * land, and the checks do not care which door set it.
 */

export type PlanName = 'FREE' | 'PRO';

export interface PlanLimits {
    aiMessagesPerDay: number;
    maxBots: number;
    maxCustomIndicators: number;
    maxStoredBacktests: number;
    /** The QuickJS code tier — PRO only, and only once it ships. */
    codeIndicators: boolean;
}

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
    FREE: {
        aiMessagesPerDay: 30,
        maxBots: 3,
        maxCustomIndicators: 5,
        maxStoredBacktests: 30,
        codeIndicators: false,
    },
    PRO: {
        aiMessagesPerDay: 300,
        maxBots: 20,
        maxCustomIndicators: 20,
        maxStoredBacktests: 100,
        codeIndicators: true,
    },
};

/**
 * Everything unlocked for everyone.
 *
 * There is no payment gateway, and until there is, a paywall only stops
 * users from using the app — it cannot earn anything. So the tiers stay in
 * the code, wired and tested, and this one switch decides whether they
 * apply. Set FREE_FOR_ALL=false to turn charging back on; nothing else has
 * to change, and no user's `plan` column is touched in the meantime.
 *
 * The one real cost this opens up is the AI bill, which is why
 * AI_FREE_DAILY_MSGS still caps it — see aiDailyLimitFor below.
 */
export const FREE_FOR_ALL = process.env.FREE_FOR_ALL !== 'false';

export function planOf(user: any): PlanName {
    if (FREE_FOR_ALL) return 'PRO';
    if (user?.role === 'admin') return 'PRO';
    return user?.plan === 'PRO' ? 'PRO' : 'FREE';
}

export function limitsFor(user: any): PlanLimits {
    return PLAN_LIMITS[planOf(user)];
}

/**
 * The daily AI cap.
 *
 * `AI_FREE_DAILY_MSGS` used to apply only to FREE users, which made it
 * useless the moment everyone became PRO — and the AI bill is the one cost
 * that giving the app away does not remove. It now applies to anyone who is
 * not an admin, so there is still a lever if the spend runs away.
 */
export function aiDailyLimitFor(user: any): number {
    if (user?.role === 'admin') return 100_000;
    const env = Number(process.env.AI_FREE_DAILY_MSGS);
    if (Number.isFinite(env) && env > 0) return env;
    return limitsFor(user).aiMessagesPerDay;
}
