/**
 * Risk guard + backtest cache key tests.
 *
 * Run with:  npx ts-node src/services/riskGuard.test.ts
 */

import { DEFAULT_RISK_GUARD, evaluateRiskGuard, riskGuardConfig } from './riskGuard';
import { backtestCacheKey } from './backtest/cacheKey';
import { StrategySpec } from './strategy/types';

let passed = 0;
const failures: string[] = [];
function check(name: string, got: unknown, want: unknown) {
    if (got === want) passed++;
    else failures.push(`${name}\n      got  ${String(got)}\n      want ${String(want)}`);
}
function section(t: string) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`); }

const NOW = Date.UTC(2026, 7, 23, 15, 0);
const HOUR = 3600_000;
const closed = (hoursAgo: number, net: number) => ({
    finalProfit: net, closeTime: new Date(NOW - hoursAgo * HOUR),
});

section('risk guard: opt-in, and off by default');
{
    check('default is OFF', DEFAULT_RISK_GUARD.enabled, false);
    const off = evaluateRiskGuard(DEFAULT_RISK_GUARD, [closed(1, -5000)], 10_000, NOW);
    check('OFF never locks', off.locked, false);
    check('but still reports today', off.readings.todayRealised, -5000);
}

section('daily loss lock: 3% of 10,000 = $300');
{
    const cfg = { enabled: true, maxDailyLossPct: 3, maxDailyLosses: 0 };
    const under = evaluateRiskGuard(cfg, [closed(2, -120), closed(1, -100)], 10_000, NOW);
    check('-220 stays open', under.locked, false);
    check('limit reported to the client', under.readings.limitMoney, -300);

    const over = evaluateRiskGuard(cfg, [closed(2, -120), closed(1, -200)], 10_000, NOW);
    check('-320 locks', over.locked, true);
    check('reason named', over.reason, 'dailyLoss');
    check('persian message carries the numbers', over.fa.includes('320'), true);
    check('unlock is next UTC midnight', new Date(over.unlocksAt).toISOString(), '2026-08-24T00:00:00.000Z');

    // Wins offset losses: realised P/L, not gross losses.
    const offset = evaluateRiskGuard(cfg, [closed(3, -400), closed(1, +250)], 10_000, NOW);
    check('a win pulls it back under', offset.locked, false);

    // Yesterday does not count.
    const yesterday = evaluateRiskGuard(cfg, [closed(30, -900)], 10_000, NOW);
    check('yesterday is not today', yesterday.locked, false);
    check('and today shows zero', yesterday.readings.todayRealised, 0);
}

section('losing-trade count lock');
{
    const cfg = { enabled: true, maxDailyLossPct: 0, maxDailyLosses: 3 };
    const two = evaluateRiskGuard(cfg, [closed(3, -10), closed(2, -10), closed(1, +50)], 10_000, NOW);
    check('2 losses stay open', two.locked, false);
    check('losses counted, wins ignored', two.readings.todayLosses, 2);

    const three = evaluateRiskGuard(cfg, [closed(3, -10), closed(2, -10), closed(1, -10)], 10_000, NOW);
    check('3 losses lock', three.locked, true);
    check('reason named', three.reason, 'dailyLosses');
}

section('config merging');
{
    check('garbage falls back', riskGuardConfig({ maxDailyLossPct: 'x' }).maxDailyLossPct, DEFAULT_RISK_GUARD.maxDailyLossPct);
    check('negatives fall back', riskGuardConfig({ maxDailyLossPct: -2 }).maxDailyLossPct, DEFAULT_RISK_GUARD.maxDailyLossPct);
    check('zero means off and is kept', riskGuardConfig({ maxDailyLossPct: 0 }).maxDailyLossPct, 0);
    check('enabled must be explicit', riskGuardConfig({}).enabled, false);
    check('null row is safe', riskGuardConfig(null).enabled, false);
}

section('backtest cache key: same question, same key');
{
    const spec: StrategySpec = {
        name: 'x', symbol: 'EUR/USD', timeframe: '1h',
        indicators: { fast: { type: 'EMA', period: 12 }, slow: { type: 'EMA', period: 26 } },
        entry: { long: { crossesAbove: ['fast', 'slow'] } },
        exit: { stopLoss: { pips: 30 } },
        sizing: { riskPercent: 1 },
    };
    const DAY = 86_400_000;
    const from = Date.UTC(2026, 5, 1);
    const to = Date.UTC(2026, 7, 1);

    const k1 = backtestCacheKey(spec, from, to, 10_000);
    check('stable across calls', backtestCacheKey(spec, from, to, 10_000), k1);
    check('five minutes later is the same day', backtestCacheKey(spec, from + 5 * 60_000, to + 5 * 60_000, 10_000), k1);
    check('a different day misses', backtestCacheKey(spec, from, to + DAY, 10_000) !== k1, true);
    check('a different balance misses', backtestCacheKey(spec, from, to, 5_000) !== k1, true);

    // Key ordering must not matter: same meaning, same key.
    const reordered: any = {
        sizing: { riskPercent: 1 },
        exit: { stopLoss: { pips: 30 } },
        entry: { long: { crossesAbove: ['fast', 'slow'] } },
        indicators: { slow: { period: 26, type: 'EMA' }, fast: { period: 12, type: 'EMA' } },
        timeframe: '1h', symbol: 'EUR/USD', name: 'x',
    };
    check('key order does not change the hash', backtestCacheKey(reordered, from, to, 10_000), k1);

    // A real parameter change must miss.
    const changed = JSON.parse(JSON.stringify(spec));
    changed.indicators.fast.period = 13;
    check('a changed period misses', backtestCacheKey(changed, from, to, 10_000) !== k1, true);
    check('key is short enough for the column', k1.length <= 80, true);
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
