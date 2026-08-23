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

export function planOf(user: any): PlanName {
    if (user?.role === 'admin') return 'PRO';
    return user?.plan === 'PRO' ? 'PRO' : 'FREE';
}

export function limitsFor(user: any): PlanLimits {
    return PLAN_LIMITS[planOf(user)];
}

/** Env override kept for ops flexibility; the plan is the default source. */
export function aiDailyLimitFor(user: any): number {
    if (user?.role === 'admin') return 100_000;
    const env = Number(process.env.AI_FREE_DAILY_MSGS);
    if (Number.isFinite(env) && env > 0 && planOf(user) === 'FREE') return env;
    return limitsFor(user).aiMessagesPerDay;
}
