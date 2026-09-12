/** Screener maths and the sentiment fold. Run: npx ts-node src/services/screener.test.ts */
import assert from 'assert';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-key';
/* eslint-disable @typescript-eslint/no-var-requires */
const { ema, rsi, atr, computeRow } = require('./screener') as typeof import('./screener');
const { foldSentiment } = require('./sentiment') as typeof import('./sentiment');

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };
const near = (a: number | null, b: number, tol = 1e-6) => assert.ok(a != null && Math.abs(a - b) < tol, `${a} ≈ ${b}`);

console.log('screener');

test('ema of a constant series is the constant; too short is null', () => {
    near(ema([5, 5, 5, 5, 5], 3), 5);
    assert.equal(ema([1, 2], 3), null);
});

test('rsi: all gains → 100, all losses → 0, textbook mixed series ~70', () => {
    near(rsi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]), 100);
    near(rsi([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]), 0);
    // Wilder's own example (Cutler-free, 14 periods): the classic closes.
    const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
    const v = rsi(closes)!;
    assert.ok(v > 55 && v < 75, `rsi ${v}`);
});

test('atr grows with range', () => {
    const calm = Array.from({ length: 30 }, (_, i) => ({ timestamp: i, open: 100, high: 100.5, low: 99.5, close: 100, volume: 1 }));
    const wild = calm.map(b => ({ ...b, high: 103, low: 97 }));
    assert.ok(atr(wild)! > atr(calm)! * 3);
});

test('computeRow classifies an uptrend and places price at the top of its range', () => {
    const bars = Array.from({ length: 120 }, (_, i) => { const c = 100 + i * 0.5; return { timestamp: i, open: c - 0.2, high: c + 0.3, low: c - 0.4, close: c, volume: 1000 + (i === 119 ? 2000 : 0) }; });
    const row = computeRow('TEST', bars, 123)!;
    assert.equal(row.trend, 'up');
    assert.ok(row.rangePos! > 90, `rangePos ${row.rangePos}`);
    assert.ok(row.change24hPct! > 0);
    assert.ok(row.volumeRatio! > 2.5, `volumeRatio ${row.volumeRatio}`);
    assert.equal(row.updatedAt, 123);
    assert.equal(row.bars, 120);
});

test('computeRow refuses a series too short to mean anything', () => {
    assert.equal(computeRow('X', [{ timestamp: 1, open: 1, high: 1, low: 1, close: 1, volume: 0 }]), null);
});

test('foldSentiment counts traders once per symbol, net of their own hedges', () => {
    const m = foldSentiment([
        { symbol: 'GOLD', side: 'BUY', volume: 1, userId: 'a' },
        { symbol: 'GOLD', side: 'BUY', volume: 0.5, userId: 'a' },
        { symbol: 'GOLD', side: 'SELL', volume: 2, userId: 'b' },
        { symbol: 'GOLD', side: 'BUY', volume: 0.1, userId: 'c' },
        { symbol: 'GOLD', side: 'SELL', volume: 0.1, userId: 'c' }, // flat on net → not counted as positioned
        { symbol: 'BTC/USDT', side: 'BUY', volume: 0.2, userId: 'a' },
    ]);
    const g = m.get('GOLD')!;
    assert.equal(g.longs, 3); assert.equal(g.shorts, 2);
    assert.equal(g.traders, 3);
    assert.equal(g.longPct, 50); // a long, b short, c flat
    near(g.longVolume, 1.6); near(g.shortVolume, 2.1);
    assert.equal(m.get('BTC/USDT')!.longPct, 100);
});

console.log(`\n${passed} passed`);
