/**
 * Plan limits tests — the one table every cap reads.
 *
 * Run with:  npx ts-node src/services/plans.test.ts
 */

import { PLAN_LIMITS, aiDailyLimitFor, limitsFor, planOf } from './plans';

let passed = 0;
const failures: string[] = [];
function check(name: string, got: unknown, want: unknown) {
    if (got === want) passed++;
    else failures.push(`${name}\n      got  ${String(got)}\n      want ${String(want)}`);
}
function section(t: string) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`); }

section('plan resolution');
{
    check('default is FREE', planOf({}), 'FREE');
    check('null user is FREE', planOf(null), 'FREE');
    check('PRO resolves', planOf({ plan: 'PRO' }), 'PRO');
    check('garbage plan falls back to FREE', planOf({ plan: 'PLATINUM' }), 'FREE');
    check('admin is treated as PRO', planOf({ role: 'admin' }), 'PRO');
}

section('limits table sanity');
{
    check('FREE bots < PRO bots', PLAN_LIMITS.FREE.maxBots < PLAN_LIMITS.PRO.maxBots, true);
    check('FREE ai < PRO ai', PLAN_LIMITS.FREE.aiMessagesPerDay < PLAN_LIMITS.PRO.aiMessagesPerDay, true);
    check('code tier is PRO-only', PLAN_LIMITS.FREE.codeIndicators, false);
    check('limitsFor routes by plan', limitsFor({ plan: 'PRO' }).maxBots, PLAN_LIMITS.PRO.maxBots);
}

section('AI daily limit precedence');
{
    delete process.env.AI_FREE_DAILY_MSGS;
    check('FREE gets plan default', aiDailyLimitFor({}), PLAN_LIMITS.FREE.aiMessagesPerDay);
    check('PRO gets plan default', aiDailyLimitFor({ plan: 'PRO' }), PLAN_LIMITS.PRO.aiMessagesPerDay);
    process.env.AI_FREE_DAILY_MSGS = '55';
    check('env overrides FREE only', aiDailyLimitFor({}), 55);
    check('env does not touch PRO', aiDailyLimitFor({ plan: 'PRO' }), PLAN_LIMITS.PRO.aiMessagesPerDay);
    delete process.env.AI_FREE_DAILY_MSGS;
    check('admin unlimited', aiDailyLimitFor({ role: 'admin' }) > 1000, true);
}

console.log(`\n${'═'.repeat(64)}`);
if (failures.length === 0) {
    console.log(`✅ all ${passed} assertions passed`);
    process.exit(0);
} else {
    console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}\n`));
    process.exit(1);
}
