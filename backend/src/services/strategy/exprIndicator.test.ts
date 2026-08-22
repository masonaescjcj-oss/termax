/**
 * Expression indicator tests — parser rejections, hand-computed rolling
 * values, composite expressions, and determinism.
 *
 * Run with:  npx ts-node src/services/strategy/exprIndicator.test.ts
 */

import { Bar } from './types';
import { compileExpr, evalExprOverBars, parseExpr, MAX_EXPR_NODES } from './exprIndicator';

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
const bar = (i: number, close: number, high = close, low = close, open = close): Bar =>
    ({ time: i * MIN, open, high, low, close, volume: 10 });

const closes = (xs: number[]): Bar[] => xs.map((c, i) => bar(i, c));

// ── parser ──────────────────────────────────────────────────────────
section('parser: precise rejections');
{
    check('valid expr parses', parseExpr('(close - EMA(close, 20)) / ATR(14) * 100').ok, true);
    check('empty rejected', parseExpr('').ok, false);
    const unknownFn = parseExpr('FOO(close, 5)');
    check('unknown function rejected', unknownFn.ok, false);
    check('error names available functions', !unknownFn.ok && unknownFn.errors[0].message.includes('SMA'), true);
    check('unknown identifier rejected', parseExpr('closee + 1').ok, false);
    check('unbalanced parens rejected', parseExpr('SMA(close, 5').ok, false);
    check('trailing garbage rejected', parseExpr('close + 1 close').ok, false);
    check('period must be a literal', parseExpr('SMA(close, close)').ok, false);
    check('period bounds enforced', parseExpr('SMA(close, 9999)').ok, false);
    check('zero period rejected', parseExpr('SMA(close, 0)').ok, false);
    check('nested calls allowed', parseExpr('SMA(EMA(close, 5), 3)').ok, true);
    check('MIN needs two args', parseExpr('MIN(close)').ok, false);

    // Node cap: a long chain of additions.
    const big = Array.from({ length: MAX_EXPR_NODES + 5 }, () => 'close').join(' + ');
    check('node cap enforced', parseExpr(big).ok, false);
}

// ── hand-computed rolling values ────────────────────────────────────
section('rolling maths: SMA, REF, HIGHEST, STDDEV by hand');
{
    const bars = closes([1, 2, 3, 4, 5, 6]);

    const sma = evalExprOverBars('SMA(close, 3)', bars);
    check('SMA warm-up drops 2 bars', sma.ok && sma.values.length, 4);
    check('SMA(3) of 1,2,3 = 2', (sma as any).values[0].value, 2, 1e-12);
    check('SMA(3) of 4,5,6 = 5', (sma as any).values[3].value, 5, 1e-12);

    const ref = evalExprOverBars('close - REF(close, 2)', bars);
    check('REF(2): 3-1 = 2 first', (ref as any).values[0].value, 2, 1e-12);
    check('REF keeps constant diff', (ref as any).values[3].value, 2, 1e-12);

    const hi = evalExprOverBars('HIGHEST(close, 3) - LOWEST(close, 3)', bars);
    check('range of any 3 consecutive = 2', (hi as any).values[0].value, 2, 1e-12);

    // STDDEV(3) of [2,4,6]: mean 4, var (4+0+4)/3 -> sqrt(8/3).
    const sd = evalExprOverBars('STDDEV(close, 3)', closes([2, 4, 6]));
    check('population stddev', (sd as any).values[0].value, Math.sqrt(8 / 3), 1e-12);

    const sum = evalExprOverBars('SUM(volume, 3)', bars);
    check('SUM over volume', (sum as any).values[0].value, 30, 1e-12);
}

section('EMA, RSI, ATR: reference implementations agree');
{
    // EMA(3) seeded with SMA of first 3: [1,2,3,4,5] -> seed 2; then
    // k=0.5: 4*0.5+2*0.5=3; 5*0.5+3*0.5=4.
    const ema = evalExprOverBars('EMA(close, 3)', closes([1, 2, 3, 4, 5]));
    check('EMA seed', (ema as any).values[0].value, 2, 1e-12);
    check('EMA step 2', (ema as any).values[2].value, 4, 1e-12);

    // RSI(2) on 1,2,3,2: diffs +1,+1,-1. Warm avg over first 2 diffs:
    // gain 1, loss 0 -> RSI 100. Next: gain (1*1+0)/2=0.5, loss (0+1)/2=0.5 -> 50.
    const rsi = evalExprOverBars('RSI(close, 2)', closes([1, 2, 3, 2]));
    check('RSI hits 100 on pure gains', (rsi as any).values[0].value, 100, 1e-9);
    check('RSI balances to 50', (rsi as any).values[1].value, 50, 1e-9);

    // ATR(2) with explicit ranges: TRs are 2,2,2 -> ATR settles at 2.
    const atrBars = [bar(0, 10, 11, 9), bar(1, 10, 11, 9), bar(2, 10, 11, 9)];
    const atr = evalExprOverBars('ATR(2)', atrBars);
    check('ATR of constant TR', (atr as any).values[(atr as any).values.length - 1].value, 2, 1e-12);
}

section('composites, NaN discipline, determinism');
{
    // Distance from EMA in ATR units — the doc's flagship example.
    const trend = closes(Array.from({ length: 60 }, (_, i) => 100 + i));
    const comp = evalExprOverBars('(close - EMA(close, 10)) / ATR(10)', trend);
    check('composite produces values', comp.ok && (comp as any).values.length > 0, true);
    // In a perfect +1/bar trend with zero range, TR = |close - prevClose| = 1
    // so ATR = 1, and close - EMA(10) converges to a constant.
    const last = (comp as any).values[(comp as any).values.length - 1].value;
    const prev = (comp as any).values[(comp as any).values.length - 2].value;
    check('composite converges in a linear trend', Math.abs(last - prev) < 0.05, true);

    const div = evalExprOverBars('close / (close - close)', closes([1, 2, 3]));
    check('division by zero yields no values, not Infinity', (div as any).values.length, 0);

    const a = evalExprOverBars('RSI(close, 14) - 50', trend);
    const b = evalExprOverBars('RSI(close, 14) - 50', trend);
    check('deterministic', JSON.stringify(a) === JSON.stringify(b), true);

    // Incremental and batch agree.
    const compiled = compileExpr('SMA(close, 3)');
    if (compiled.ok) {
        const seq = closes([1, 2, 3, 4, 5, 6]);
        const inc: number[] = [];
        for (const b2 of seq) {
            const v = compiled.expr.update(b2);
            if (Number.isFinite(v)) inc.push(v);
        }
        check('incremental == batch', JSON.stringify(inc), JSON.stringify((evalExprOverBars('SMA(close, 3)', seq) as any).values.map((v: any) => v.value)));
    }
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
