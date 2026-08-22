/**
 * Backfill tests — the feed router is stubbed; what is verified is the
 * paging logic: resume after the last stored bar, march through empty
 * weekend pages instead of aborting, dedup via the store, and the
 * no-source short-circuit.
 *
 * Run with:  npx ts-node src/services/candles/backfill.test.ts
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { __setCandleRoot, appendBars, readBars } from './store';
import { Bar } from '../strategy/types';

/* eslint-disable @typescript-eslint/no-var-requires */
const feeds = require('../feeds');
const { backfillRange, coverage } = require('./backfill') as typeof import('./backfill');

let passed = 0;
const failures: string[] = [];
function check(name: string, got: unknown, want: unknown) {
    if (got === want) passed++;
    else failures.push(`${name}\n      got  ${String(got)}\n      want ${String(want)}`);
}

const MIN = 60_000;
const bar = (time: number, c: number): Bar => ({ time, open: c, high: c, low: c, close: c, volume: 1 });

async function main() {
    const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'termax-backfill-'));
    __setCandleRoot(ROOT);

    // Fake history: minutes [T0, T0+3000min) exist except a 1000-minute
    // "weekend" hole in the middle third. Dates are recent — backfill
    // clamps to its 400-day horizon and to now.
    const T0 = Math.floor((Date.now() - 3100 * MIN) / MIN) * MIN;
    const HOLE_FROM = T0 + 1000 * MIN;
    const HOLE_TO = T0 + 2000 * MIN;
    const calls: Array<[number, number]> = [];
    feeds.feedRouter.getCandlesRange = async (_s: string, _tf: string, fromMs: number, toMs: number) => {
        calls.push([fromMs, toMs]);
        const out: Bar[] = [];
        for (let t = fromMs; t < toMs; t += MIN) {
            if (t >= HOLE_FROM && t < HOLE_TO) continue;
            out.push(bar(t, 1.1));
        }
        return out;
    };

    // Seed the store with the first 100 minutes — backfill must resume after
    // them, not refetch from the window start.
    appendBars('EUR/USD', Array.from({ length: 100 }, (_, i) => bar(T0 + i * MIN, 1.1)));

    const to = T0 + 3000 * MIN;
    const outcome = await backfillRange('EUR/USD', T0, to);
    check('resumes after stored bars', calls[0][0], T0 + 100 * MIN);
    check('writes exactly the missing bars', outcome.barsWritten, 3000 - 100 - 1000);
    check('empty pages advanced, not aborted', calls.length, 3);
    check('store now holds everything available', readBars('EUR/USD', T0, to).length, 2000);
    check('re-run is a no-op', (await backfillRange('EUR/USD', T0, to)).barsWritten, 0);
    check('coverage reflects the hole', Math.round(coverage('EUR/USD', T0, to) * 100), 67);

    // No feed has this symbol at all -> flagged, and only one probe made.
    feeds.feedRouter.getCandlesRange = async () => null;
    const none = await backfillRange('AAPL', T0, to);
    check('no source flagged', none.noSource, true);
    check('stops after the first empty probe', none.pages, 1);

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
