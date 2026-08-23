/**
 * Live gate + trade stats tests.
 *
 * Run with:  npx ts-node src/services/bots/liveGate.test.ts
 */

import { evaluateLiveGate, gateRequirements } from './liveGate';
import { computeTradeStats } from './tradeStats';
import { initialBotState } from '../strategy/types';
import { DEFAULT_WATCHDOG } from './watchdog';
import { BotRow } from '../../models/Bot';

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

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 7, 22, 12, 0);

const rowAt = (startedDaysAgo: number, status: BotRow['status'] = 'FORWARD_TEST'): BotRow => ({
    id: 'b1', userId: 'u1', accountId: 'a1', name: 'g', spec: {} as any,
    status, runState: initialBotState(), liveVolumeMode: 'MIN', origin: 'USER', watchdog: DEFAULT_WATCHDOG,
    startedAt: new Date(NOW - startedDaysAgo * DAY), liveStartedAt: null, stoppedAt: null,
    createdAt: new Date(0), updatedAt: new Date(0),
});

const trade = (closeDaysAgo: number, net: number, holdMin = 60) => ({
    finalProfit: net,
    openTime: new Date(NOW - closeDaysAgo * DAY - holdMin * 60_000),
    closeTime: new Date(NOW - closeDaysAgo * DAY),
});

// ── trade stats ─────────────────────────────────────────────────────
section('trade stats: hand-computed record');
{
    // +50, -30, +20, -30, +100 → net 110, GP 170, GL 60, PF 2.833,
    // cumulative path 50,20,40,10,110 → max drawdown = 50-10 = 40... wait:
    // peaks: 50→dd 30 at 20; 50 vs 40 dd 10; 50 vs 10 dd 40; then 110. = 40.
    const s = computeTradeStats([
        trade(10, 50), trade(8, -30), trade(6, 20), trade(4, -30), trade(2, 100),
    ]);
    check('trades', s.trades, 5);
    check('win rate 60', s.winRate, 60, 1e-9);
    check('net 110', s.netProfit, 110, 1e-9);
    check('profit factor 170/60', s.profitFactor!, 170 / 60, 1e-9);
    check('expectancy 22', s.expectancy, 22, 1e-9);
    check('max drawdown 40', s.maxDrawdown, 40, 1e-9);
    check('avg hold 60 min', s.avgHoldMinutes, 60, 1e-9);
    check('empty record is all zeros', computeTradeStats([]).trades, 0);
}

// ── gate ────────────────────────────────────────────────────────────
section('live gate: both requirements must hold');
{
    delete process.env.LIVE_GATE_MIN_DAYS;
    delete process.env.LIVE_GATE_MIN_TRADES;
    check('default 14 days', gateRequirements().minDays, 14);
    check('default 20 trades', gateRequirements().minTrades, 20);

    const trades25 = Array.from({ length: 25 }, (_, i) => trade(1 + i * 0.5, i % 2 ? 30 : -10));

    // Too young, enough trades.
    let v = evaluateLiveGate(rowAt(5), computeTradeStats(trades25), NOW);
    check('young bot blocked', v.eligible, false);
    check('one reason: days', v.reasons.length, 1);

    // Old enough, too few trades.
    v = evaluateLiveGate(rowAt(20), computeTradeStats(trades25.slice(0, 6)), NOW);
    check('thin record blocked', v.eligible, false);
    check('one reason: trades', v.reasons.length, 1);

    // Both satisfied.
    v = evaluateLiveGate(rowAt(20), computeTradeStats(trades25), NOW);
    check('gate opens', v.eligible, true);
    check('no reasons when open', v.reasons.length, 0);
    check('profitable record not flagged', v.losingRecord, false);

    // Losing record: open but flagged.
    const losers = Array.from({ length: 25 }, (_, i) => trade(1 + i * 0.5, -5));
    v = evaluateLiveGate(rowAt(20), computeTradeStats(losers), NOW);
    check('losing record still eligible', v.eligible, true);
    check('but flagged for acknowledgement', v.losingRecord, true);

    // Already live.
    v = evaluateLiveGate(rowAt(20, 'LIVE'), computeTradeStats(trades25), NOW);
    check('live bot cannot pass again', v.eligible, false);
}

// ── configurable thresholds ─────────────────────────────────────────
section('live gate: env-configured thresholds');
{
    process.env.LIVE_GATE_MIN_DAYS = '3';
    process.env.LIVE_GATE_MIN_TRADES = '5';
    const trades6 = Array.from({ length: 6 }, (_, i) => trade(0.5 + i * 0.3, 10));
    const v = evaluateLiveGate(rowAt(4), computeTradeStats(trades6), NOW);
    check('relaxed gate opens sooner', v.eligible, true);
    delete process.env.LIVE_GATE_MIN_DAYS;
    delete process.env.LIVE_GATE_MIN_TRADES;
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
