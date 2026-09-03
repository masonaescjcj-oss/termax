/**
 * Whether the AI provider is actually answering.
 *
 * An admin replacing a dead key had no way to know it worked, and no way to
 * know it had died in the first place: the failure surfaced only as users
 * getting an error, and nobody tells the admin. This records the outcome of
 * every real call so the console can show the truth instead of the
 * configuration.
 *
 * Deliberately in memory, not the database. It describes this process right
 * now — writing it down would cost a database round trip on the hot path of
 * every AI message, which is the mistake that produced the 500k-request
 * bill. It resets on restart, which is correct: a restarted process has not
 * yet proven anything.
 */

export type AIHealth = {
    lastOkAt: string | null;
    lastFailAt: string | null;
    lastFailMessage: string | null;
    /** Which provider answered last: the primary or the fallback. */
    lastServedBy: 'primary' | 'fallback' | null;
    okCount: number;
    failCount: number;
    /** Consecutive failures. Anything above zero is worth showing. */
    failStreak: number;
};

const health: AIHealth = {
    lastOkAt: null,
    lastFailAt: null,
    lastFailMessage: null,
    lastServedBy: null,
    okCount: 0,
    failCount: 0,
    failStreak: 0,
};

export function recordAIOk(servedBy: 'primary' | 'fallback' = 'primary') {
    health.lastOkAt = new Date().toISOString();
    health.lastServedBy = servedBy;
    health.okCount++;
    health.failStreak = 0;
}

export function recordAIFailure(err: unknown) {
    health.lastFailAt = new Date().toISOString();
    health.lastFailMessage = describe(err);
    health.failCount++;
    health.failStreak++;
}

export function aiHealth(): AIHealth {
    return { ...health };
}

/** Testing seam. */
export function __resetAIHealth() {
    Object.assign(health, {
        lastOkAt: null, lastFailAt: null, lastFailMessage: null,
        lastServedBy: null, okCount: 0, failCount: 0, failStreak: 0,
    });
}

/**
 * A provider error in words an admin can act on.
 *
 * The raw message from the SDK is often a wall of JSON, and the status is
 * the part that says what to do: 401 means the key, 429 means the bill.
 */
export function describe(err: any): string {
    const status = err?.status ?? err?.response?.status;
    const detail =
        err?.error?.message ??
        err?.response?.data?.error?.message ??
        err?.message ??
        String(err);

    if (status === 401 || status === 403) return `The provider rejected the API key (${status}). ${detail}`;
    if (status === 429) return `The provider is rate-limiting or the quota is spent (429). ${detail}`;
    if (status === 404) return `The provider does not know that model (404). ${detail}`;
    if (status >= 500) return `The provider is failing (${status}). ${detail}`;
    return String(detail).slice(0, 300);
}
