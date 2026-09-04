/**
 * Plan limits tests — the one table every cap reads.
 *
 * The app is given away: FREE_FOR_ALL defaults on, so every user resolves
 * to PRO and nothing is gated. The tiers are still here, and this file
 * still proves them, because "turn charging back on" has to be one
 * environment variable and not a rewrite. So both modes are tested: the
 * table's own shape, the tiers with the switch off, and everyone unlocked
 * with it on.
 *
 * Run with:  npx ts-node src/services/plans.test.ts
 */

// Loaded twice, once per mode. FREE_FOR_ALL is read when the module is
// evaluated, which is what makes it free to check on the hot paths.
const loadPlans = (freeForAll: boolean) => {
    process.env.FREE_FOR_ALL = freeForAll ? 'true' : 'false';
    delete require.cache[require.resolve('./plans')];
    return require('./plans');
};

const paid = loadPlans(false);
const { PLAN_LIMITS } = paid;

let passed = 0;
const failures: string[] = [];
function check(name: string, got: unknown, want: unknown) {
    if (got === want) passed++;
    else failures.push(`${name}\n      got  ${String(got)}\n      want ${String(want)}`);
}
function section(t: string) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`); }

section('plan resolution, with charging on');
{
    const { planOf } = paid;
    check('default is FREE', planOf({}), 'FREE');
    check('null user is FREE', planOf(null), 'FREE');
    check('PRO resolves', planOf({ plan: 'PRO' }), 'PRO');
    check('garbage plan falls back to FREE', planOf({ plan: 'PLATINUM' }), 'FREE');
    check('admin is treated as PRO', planOf({ role: 'admin' }), 'PRO');
}

section('and with the app given away');
{
    const free = loadPlans(true);
    check('the switch is on by default', process.env.FREE_FOR_ALL, 'true');
    check('everyone resolves to PRO', free.planOf({}), 'PRO');
    check('including a signed-out request', free.planOf(null), 'PRO');
    check('a FREE column is ignored, not rewritten', free.planOf({ plan: 'FREE' }), 'PRO');
    check('so every feature is unlocked', free.limitsFor({}).codeIndicators, true);
    check('and the bot cap is the PRO one', free.limitsFor({}).maxBots, PLAN_LIMITS.PRO.maxBots);

    // The AI bill is the one cost giving the app away does not remove, so
    // the cap has to still bite when it is set. It used to apply to FREE
    // users only, which made it useless the moment everyone became PRO.
    process.env.AI_FREE_DAILY_MSGS = '40';
    const capped = loadPlans(true);
    check('the AI cap still applies to everyone', capped.aiDailyLimitFor({}), 40);
    check('and to a PRO column too', capped.aiDailyLimitFor({ plan: 'PRO' }), 40);
    check('but never to an admin', capped.aiDailyLimitFor({ role: 'admin' }) > 1000, true);
    delete process.env.AI_FREE_DAILY_MSGS;
}

section('limits table sanity');
{
    const { limitsFor } = paid;
    check('FREE bots < PRO bots', PLAN_LIMITS.FREE.maxBots < PLAN_LIMITS.PRO.maxBots, true);
    check('FREE ai < PRO ai', PLAN_LIMITS.FREE.aiMessagesPerDay < PLAN_LIMITS.PRO.aiMessagesPerDay, true);
    check('code tier is PRO-only', PLAN_LIMITS.FREE.codeIndicators, false);
    check('limitsFor routes by plan', limitsFor({ plan: 'PRO' }).maxBots, PLAN_LIMITS.PRO.maxBots);
}

section('AI daily limit precedence, with charging on');
{
    delete process.env.AI_FREE_DAILY_MSGS;
    const { aiDailyLimitFor } = loadPlans(false);
    check('FREE gets plan default', aiDailyLimitFor({}), PLAN_LIMITS.FREE.aiMessagesPerDay);
    check('PRO gets plan default', aiDailyLimitFor({ plan: 'PRO' }), PLAN_LIMITS.PRO.aiMessagesPerDay);

    process.env.AI_FREE_DAILY_MSGS = '55';
    const capped = loadPlans(false).aiDailyLimitFor;
    check('the env cap applies to FREE', capped({}), 55);
    check('and now to PRO as well', capped({ plan: 'PRO' }), 55);
    delete process.env.AI_FREE_DAILY_MSGS;
    check('admin unlimited', loadPlans(false).aiDailyLimitFor({ role: 'admin' }) > 1000, true);
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
