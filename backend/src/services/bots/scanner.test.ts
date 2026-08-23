/**
 * Setup scanner tests — real candles in the store, a spec whose trigger
 * we place deliberately on some symbols and not others.
 *
 * Run with:  npx ts-node src/services/bots/scanner.test.ts
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { __setCandleRoot, appendBars } from '../candles/store';
import { setQuote, __resetQuotes } from '../pricing';
import { Bar, StrategySpec } from '../strategy/types';
import { SCAN_LOOKBACK_BARS, scanSpec } from './scanner';

let passed = 0;
const failures: string[] = [];
function check(name: string, got: unknown, want: unknown) {
    if (got === want) passed++;
    else failures.push(`${name}\n      got  ${String(got)}\n      want ${String(want)}`);
}
function section(t: string) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`); }

const MIN = 60_000;

/**
 * Build 1m bars whose close crosses `level` upward exactly `barsFromEnd`
 * bars before the end — or never, when barsFromEnd is null.
 */
function seriesCrossing(count: number, level: number, barsFromEnd: number | null, startMs: number): Bar[] {
    const bars: Bar[] = [];
    const crossIndex = barsFromEnd === null ? -1 : count - 1 - barsFromEnd;
    for (let i = 0; i < count; i++) {
        const close = crossIndex >= 0 && i >= crossIndex ? level + 0.0020 : level - 0.0020;
        bars.push({ time: startMs + i * MIN, open: close, high: close + 0.0002, low: close - 0.0002, close, volume: 1 });
    }
    return bars;
}

async function main() {
    const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'termax-scan-'));
    __setCandleRoot(ROOT);
    __resetQuotes();

    const T0 = Math.floor(Date.now() / MIN) * MIN - 200 * MIN;
    const LEVEL = 1.1000;

    // EUR/USD crossed 2 bars ago, GBP/USD crossed 1 bar ago,
    // AUD/USD crossed 40 bars ago (stale), USD/CHF never crossed.
    appendBars('EUR/USD', seriesCrossing(200, LEVEL, 2, T0));
    appendBars('GBP/USD', seriesCrossing(200, LEVEL, 1, T0));
    appendBars('AUD/USD', seriesCrossing(200, LEVEL, 40, T0));
    appendBars('USD/CHF', seriesCrossing(200, LEVEL, null, T0));
    setQuote('EUR/USD', 1.1000, 1.1001);

    const spec: StrategySpec = {
        name: 'level break', symbol: 'EUR/USD', timeframe: '1m',
        entry: { long: { crossesAbove: ['close', LEVEL] } },
        exit: { stopLoss: { pips: 20 } },
        sizing: { fixedLots: 0.1 },
        limits: { maxTradesPerDay: 1 },
    };

    section('scanner finds fresh setups and ignores stale ones');
    {
        const r = await scanSpec(spec, ['GBP/USD', 'AUD/USD', 'USD/CHF']);
        const symbols = r.hits.map(h => h.symbol);
        check('two fresh hits', r.hits.length, 2);
        check('freshest first', symbols[0], 'GBP/USD');
        check('own symbol included', symbols.includes('EUR/USD'), true);
        check('stale cross excluded', symbols.includes('AUD/USD'), false);
        check('never-crossed excluded', symbols.includes('USD/CHF'), false);
        check('barsAgo is exact', r.hits.find(h => h.symbol === 'EUR/USD')!.barsAgo, 2);
        check('lookback window respected', r.hits.every(h => h.barsAgo <= SCAN_LOOKBACK_BARS), true);
        check('all four scanned', r.scanned.length, 4);
        check('side reported', r.hits[0].side, 'BUY');
        check('stop loss computed', r.hits[0].stopLoss > 0, true);
        check('live spread attached where known', r.hits.find(h => h.symbol === 'EUR/USD')!.spreadPips !== null, true);
    }

    section('limits are stripped: the scanner reports the market, not the bot');
    {
        // maxTradesPerDay: 1 would suppress later signals for a running
        // bot; the scanner must still see them.
        const r = await scanSpec(spec, ['GBP/USD']);
        check('daily cap does not hide the setup', r.hits.some(h => h.symbol === 'GBP/USD'), true);
    }

    section('unknown and dataless symbols are reported, not dropped');
    {
        const r = await scanSpec(spec, ['NOT/AREALPAIR', 'USD/JPY']);
        check('symbol with no candles is skipped', 'USD/JPY' in r.skipped, true);
        check('skip reason mentions candles', r.skipped['USD/JPY'].includes('candles'), true);
        check('scanned list excludes skipped', r.scanned.includes('USD/JPY'), false);
    }

    section('pip sizes follow the scanned symbol, not the spec');
    {
        // A JPY pair uses 0.01 pips: a 20-pip stop is 0.20, not 0.0020.
        // Bars must live in JPY territory, so they are built at that scale
        // rather than scaled from the EUR/USD series.
        const jpyBars: Bar[] = [];
        for (let i = 0; i < 200; i++) {
            const close = i >= 198 ? 155.20 : 154.80;
            jpyBars.push({ time: T0 + i * MIN, open: close, high: close + 0.02, low: close - 0.02, close, volume: 1 });
        }
        appendBars('USD/JPY', jpyBars);
        const jpyCross: StrategySpec = {
            ...spec, symbol: 'USD/JPY',
            entry: { long: { crossesAbove: ['close', 155] } },
        };
        const r = await scanSpec(jpyCross, []);
        const hit = r.hits.find(h => h.symbol === 'USD/JPY');
        check('JPY hit found', !!hit, true);
        if (hit) {
            const dist = Math.abs(hit.close - hit.stopLoss);
            check('20 pips on a JPY pair = 0.20', Math.abs(dist - 0.20) < 1e-9, true);
        }
    }

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
