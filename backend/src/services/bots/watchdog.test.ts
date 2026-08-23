/**
 * Watchdog tests — every threshold traced by hand, plus the two rules
 * that matter most: OFF means silent, and a trip can only ever stop a
 * bot (never invent one).
 *
 * Run with:  npx ts-node src/services/bots/watchdog.test.ts
 */

import {
    DEFAULT_WATCHDOG, EDGE_WINDOW, evaluateWatchdog, watchdogConfig,
} from './watchdog';

let passed = 0;
const failures: string[] = [];
function check(name: string, got: unknown, want: unknown, tolerance = 0) {
    let ok: boolean;
    if (typeof got === 'number' && typeof want === 'number') {
        ok = Number.isFinite(got) && Math.abs(got - want) <= tolerance;
    } else {
        ok = got === want;
    }
    if (ok) passed++;
    else failures.push(`${name}\n      got  ${String(got)}\n      want ${String(want)}`);
}
function section(t: string) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`); }

const HOUR = 3600_000;
const NOW = Date.UTC(2026, 7, 23, 12, 0);
const trade = (hoursAgo: number, net: number) => ({
    finalProfit: net,
    openTime: new Date(NOW - hoursAgo * HOUR - HOUR),
    closeTime: new Date(NOW - hoursAgo * HOUR),
});

// ── the switch ──────────────────────────────────────────────────────
section('the master switch');
{
    const brutal = [trade(1, -500), trade(2, -500), trade(3, -500)];
    const off = evaluateWatchdog({ ...DEFAULT_WATCHDOG, enabled: false }, brutal, 10_000, NOW);
    check('OFF never trips', off.tripped, false);
    check('OFF says so', off.fa.includes('خاموش'), true);
    check('OFF still reports readings', off.readings.todayNet, -1500);

    const on = evaluateWatchdog(DEFAULT_WATCHDOG, brutal, 10_000, NOW);
    check('ON trips on the same record', on.tripped, true);
}

// ── daily loss ──────────────────────────────────────────────────────
section('daily loss limit: 5% of 10,000 = $500');
{
    const cfg = { ...DEFAULT_WATCHDOG, maxConsecutiveLosses: 0, maxDrawdownPct: 0, edgeDecay: false };
    // Today: -200 -200 = -400 -> under the limit.
    const under = evaluateWatchdog(cfg, [trade(1, -200), trade(2, -200)], 10_000, NOW);
    check('-400 does not trip', under.tripped, false);
    check('today net measured', under.readings.todayNet, -400);

    // -200 -350 = -550 -> past -500.
    const over = evaluateWatchdog(cfg, [trade(1, -200), trade(2, -350)], 10_000, NOW);
    check('-550 trips', over.tripped, true);
    check('names the daily rule', over.key, 'dailyLoss');
    check('evidence carries the limit', over.evidence.limit, -500);
    check('persian message has the numbers', over.fa.includes('500'), true);

    // Yesterday's losses do not count toward today.
    const yesterday = evaluateWatchdog(cfg, [trade(30, -900)], 10_000, NOW);
    check('yesterday is not today', yesterday.tripped, false);

    // Percentages follow the account: same trades, 2,000 equity.
    const small = evaluateWatchdog(cfg, [trade(1, -150)], 2_000, NOW);
    check('-150 on a $2,000 account trips (limit -$100)', small.tripped, true);
}

// ── consecutive losses ──────────────────────────────────────────────
section('consecutive losses');
{
    const cfg = { ...DEFAULT_WATCHDOG, maxDailyLossPct: 0, maxDrawdownPct: 0, edgeDecay: false, maxConsecutiveLosses: 3 };
    // Oldest -> newest: win then 3 losses.
    const streak = evaluateWatchdog(cfg, [trade(40, +50), trade(3, -10), trade(2, -10), trade(1, -10)], 10_000, NOW);
    check('3 in a row trips', streak.tripped, true);
    check('counts exactly 3', streak.readings.consecutiveLosses, 3);
    check('names the rule', streak.key, 'consecutiveLosses');

    // A win in the middle resets the count.
    const broken = evaluateWatchdog(cfg, [trade(4, -10), trade(3, -10), trade(2, +5), trade(1, -10)], 10_000, NOW);
    check('a win resets the streak', broken.readings.consecutiveLosses, 1);
    check('and does not trip', broken.tripped, false);
}

// ── drawdown ────────────────────────────────────────────────────────
section('drawdown from the bot own peak');
{
    const cfg = { ...DEFAULT_WATCHDOG, maxDailyLossPct: 0, maxConsecutiveLosses: 0, edgeDecay: false, maxDrawdownPct: 10 };
    // Path: +1000 (peak) then -400 -400 -> cum 200; drawdown 800 = 8%.
    const under = evaluateWatchdog(cfg, [trade(50, +1000), trade(40, -400), trade(30, -400)], 10_000, NOW);
    check('8% does not trip a 10% limit', under.tripped, false);
    check('drawdown measured', under.readings.drawdown, 800);
    check('as a percentage', under.readings.drawdownPct, 8, 1e-9);

    // One more -400 -> drawdown 1200 = 12%.
    const over = evaluateWatchdog(cfg, [trade(50, +1000), trade(40, -400), trade(30, -400), trade(20, -400)], 10_000, NOW);
    check('12% trips', over.tripped, true);
    check('names the rule', over.key, 'drawdown');
}

// ── edge decay ──────────────────────────────────────────────────────
section('edge decay: recent expectancy vs the baseline');
{
    const cfg = { ...DEFAULT_WATCHDOG, maxDailyLossPct: 0, maxConsecutiveLosses: 0, maxDrawdownPct: 0, edgeDecay: true };

    // Not enough trades for the comparison to mean anything.
    const thin = evaluateWatchdog(cfg, Array.from({ length: EDGE_WINDOW }, (_, i) => trade(100 - i, +20)), 10_000, NOW);
    check('too few trades: no verdict', thin.tripped, false);
    check('and no ratio', thin.readings.edgeRatio, null);

    // 15 winners at +$20 (baseline +20), then 15 at +$2 (ratio 0.1).
    const decayed = [
        ...Array.from({ length: EDGE_WINDOW }, (_, i) => trade(300 - i, +20)),
        ...Array.from({ length: EDGE_WINDOW }, (_, i) => trade(100 - i, +2)),
    ];
    const d = evaluateWatchdog(cfg, decayed, 10_000, NOW);
    check('baseline expectancy +20', d.readings.baselineExpectancy, 20, 1e-9);
    check('recent expectancy +2', d.readings.recentExpectancy, 2, 1e-9);
    check('ratio 0.1', d.readings.edgeRatio, 0.1, 1e-9);
    check('decay trips', d.tripped, true);
    check('names the rule', d.key, 'edgeDecay');
    check('persian message quotes the window', d.fa.includes(String(EDGE_WINDOW)), true);

    // Still 60% of the edge: healthy enough, no trip.
    const healthy = [
        ...Array.from({ length: EDGE_WINDOW }, (_, i) => trade(300 - i, +20)),
        ...Array.from({ length: EDGE_WINDOW }, (_, i) => trade(100 - i, +12)),
    ];
    check('60% of the edge does not trip', evaluateWatchdog(cfg, healthy, 10_000, NOW).tripped, false);

    // A losing baseline cannot "decay" — the ratio is undefined.
    const alwaysBad = Array.from({ length: EDGE_WINDOW * 2 }, (_, i) => trade(300 - i, -5));
    const ab = evaluateWatchdog(cfg, alwaysBad, 10_000, NOW);
    check('negative baseline yields no ratio', ab.readings.edgeRatio, null);
    check('and no decay trip', ab.key === 'edgeDecay', false);
}

// ── config merging ──────────────────────────────────────────────────
section('config: partial rows merge over the defaults');
{
    check('empty object -> defaults on', watchdogConfig({}).enabled, true);
    check('explicit false survives', watchdogConfig({ enabled: false }).enabled, false);
    check('garbage numbers fall back', watchdogConfig({ maxDailyLossPct: 'abc' }).maxDailyLossPct, DEFAULT_WATCHDOG.maxDailyLossPct);
    check('negative numbers fall back', watchdogConfig({ maxDrawdownPct: -5 }).maxDrawdownPct, DEFAULT_WATCHDOG.maxDrawdownPct);
    check('zero means off and is kept', watchdogConfig({ maxConsecutiveLosses: 0 }).maxConsecutiveLosses, 0);
    check('unknown action falls back to PAUSE', watchdogConfig({ action: 'NUKE' }).action, 'PAUSE');
    check('ALERT is honoured', watchdogConfig({ action: 'ALERT' }).action, 'ALERT');
    check('null row -> defaults', watchdogConfig(null).action, 'PAUSE');
}

// ── every limit off ─────────────────────────────────────────────────
section('all limits zeroed: enabled but toothless');
{
    const cfg = { ...DEFAULT_WATCHDOG, maxDailyLossPct: 0, maxConsecutiveLosses: 0, maxDrawdownPct: 0, edgeDecay: false };
    const v = evaluateWatchdog(cfg, [trade(1, -9999)], 10_000, NOW);
    check('nothing trips', v.tripped, false);
    check('but the readings are still there', v.readings.todayNet, -9999);
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
