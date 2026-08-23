/**
 * Code-tier sandbox tests — the cage is the product: correct results for
 * honest code, hard kills for loops and bombs, forced determinism.
 *
 * Run with:  npx ts-node src/services/code/quickjs.test.ts
 */

import { Bar } from '../strategy/types';
import { runCodeIndicator } from './quickjsIndicator';

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

const MIN = 60_000;
const bars: Bar[] = Array.from({ length: 10 }, (_, i) => ({
    time: i * MIN, open: i + 1, high: i + 1.5, low: i + 0.5, close: i + 1, volume: 10,
}));

async function main() {
    section('honest code computes correctly');
    {
        const sma3 = `
function calc(bars) {
    return bars.map(function (b, i) {
        if (i < 2) return null;
        return (bars[i].close + bars[i-1].close + bars[i-2].close) / 3;
    });
}`;
        const r = await runCodeIndicator(sma3, bars);
        check('runs', r.ok, true);
        if (r.ok) {
            check('warm-up skipped', r.values.length, 8);
            check('SMA3 of 1,2,3 = 2', r.values[0].value, 2, 1e-12);
            check('SMA3 of 8,9,10 = 9', r.values[7].value, 9, 1e-12);
            check('times align to bars', r.values[0].time, 2 * MIN);
        }

        const objForm = `function calc(bars) { return bars.map(function(b){ return { time: b.time, value: b.close * 2 }; }); }`;
        const r2 = await runCodeIndicator(objForm, bars);
        check('object form works', r2.ok && r2.values[9].value, 20);

        const r3 = await runCodeIndicator(sma3, bars);
        check('deterministic across runs', JSON.stringify(r3) === JSON.stringify(r), true);
    }

    section('the cage holds');
    {
        const loop = `function calc(bars) { while (true) {} }`;
        const r = await runCodeIndicator(loop, bars);
        check('infinite loop killed', r.ok, false);
        check('with a time-limit message', !r.ok && r.error.includes('Time limit'), true);

        const bomb = `function calc(bars) { var a = []; while (true) { a.push(new Array(65536).fill(1)); } }`;
        const rb = await runCodeIndicator(bomb, bars);
        check('memory/time bomb killed', rb.ok, false);

        const rand = `function calc(bars) { return bars.map(function(){ return Math.random(); }); }`;
        const rr = await runCodeIndicator(rand, bars);
        check('Math.random refused', rr.ok, false);
        check('names determinism', !rr.ok && rr.error.includes('deterministic'), true);

        const date = `function calc(bars) { var d = new Date(); return [1]; }`;
        const rd = await runCodeIndicator(date, bars);
        check('Date refused', rd.ok, false);

        const noEscape = `function calc(bars) { return [typeof process, typeof require, typeof globalThis.fetch].filter(function(t){return t !== 'undefined';}).length; }`;
        const re = await runCodeIndicator(`function calc(bars) { if (typeof process !== 'undefined' || typeof require !== 'undefined') { throw new Error('leak'); } return bars.map(function(b){ return 1; }); }`, bars);
        check('no process/require inside the cage', re.ok, true);
    }

    section('clear errors for broken code');
    {
        const noCalc = `var x = 1;`;
        const r = await runCodeIndicator(noCalc, bars);
        check('missing calc named', !r.ok && r.error.includes('calc'), true);

        const badReturn = `function calc(bars) { return 42; }`;
        const rb = await runCodeIndicator(badReturn, bars);
        check('non-array return named', !rb.ok && rb.error.includes('array'), true);

        const syntax = `function calc(bars { return []; }`;
        const rs = await runCodeIndicator(syntax, bars);
        check('syntax error surfaces', rs.ok, false);

        const empty = await runCodeIndicator('   ', bars);
        check('empty code refused', empty.ok, false);

        const huge = await runCodeIndicator('x'.repeat(5000), bars);
        check('oversized code refused', !huge.ok && huge.error.includes('4000'), true);
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
}

main().catch(e => { console.error(e); process.exit(1); });
