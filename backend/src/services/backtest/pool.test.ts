/**
 * Backtest pool test — spawns REAL worker threads: proves the dev (ts-node)
 * worker entry actually boots, reads the store from an explicit candle root,
 * runs the engine + honesty grade, and that the per-user limit holds.
 *
 * Run with:  npx ts-node src/services/backtest/pool.test.ts
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { __setCandleRoot, appendBars } from '../candles/store';
import { Bar, StrategySpec } from '../strategy/types';
import { BacktestPool } from './pool';

let passed = 0;
const failures: string[] = [];
function check(name: string, got: unknown, want: unknown) {
    if (got === want) passed++;
    else failures.push(`${name}\n      got  ${String(got)}\n      want ${String(want)}`);
}

const MIN = 60_000;

async function main() {
    const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'termax-pool-'));
    __setCandleRoot(ROOT);

    // 400 minutes of a gentle sine so a crossover strategy trades a little.
    const T0 = Date.UTC(2024, 0, 2, 0, 0);
    const bars: Bar[] = [];
    for (let i = 0; i < 400; i++) {
        const mid = 1.1 + 0.003 * Math.sin(i / 15);
        bars.push({ time: T0 + i * MIN, open: mid, high: mid + 0.0002, low: mid - 0.0002, close: mid, volume: 1 });
    }
    appendBars('EUR/USD', bars);

    const spec: StrategySpec = {
        name: 'pool test', symbol: 'EUR/USD', timeframe: '5m',
        indicators: { fast: { type: 'SMA', period: 3 }, slow: { type: 'SMA', period: 10 } },
        entry: { long: { crossesAbove: ['fast', 'slow'] } },
        exit: { stopLoss: { pips: 30 }, signal: { long: { crossesBelow: ['fast', 'slow'] } } },
        sizing: { fixedLots: 0.1 },
    };
    const payload = {
        spec, fromMs: T0, toMs: T0 + 400 * MIN,
        options: { startBalance: 10_000 },
        candleRoot: ROOT,
    };

    const pool = new BacktestPool();

    // Per-user limit: two in flight fine, third refused immediately.
    const p1 = pool.run('user-1', payload);
    const p2 = pool.run('user-1', payload);
    let thirdRefused = false;
    await pool.run('user-1', payload).catch(() => { thirdRefused = true; });
    check('third concurrent job refused', thirdRefused, true);

    const [o1, o2] = await Promise.all([p1, p2]);
    check('worker returned a result', !!o1.result, true);
    check('worker graded honesty', typeof o1.honesty.grade, 'string');
    check('bars were read from the explicit root', o1.result.stats.barsProcessed, 400);
    check('the strategy actually traded', o1.result.stats.trades > 0, true);
    check('two runs of one job agree', JSON.stringify(o1), JSON.stringify(o2));
    check('limit released after completion', pool.load('user-1'), 0);

    // A window with no data fails cleanly instead of hanging.
    let failedCleanly = '';
    await pool.run('user-2', { ...payload, fromMs: T0 - 800 * MIN, toMs: T0 - 400 * MIN })
        .catch(e => { failedCleanly = e.message; });
    check('empty window fails with a message', failedCleanly.includes('Not enough stored history'), true);

    fs.rmSync(ROOT, { recursive: true, force: true });
    console.log(`\n${'═'.repeat(64)}`);
    if (failures.length === 0) {
        console.log(`✅ all ${passed} assertions passed`);
        process.exit(0);
    } else {
        console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
        failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}\n`));
        process.exit(1);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
