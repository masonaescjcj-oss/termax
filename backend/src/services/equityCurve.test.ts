/** Equity curve maths. Run: npx ts-node src/services/equityCurve.test.ts */
import assert from 'assert';
import { buildCurve, monthlyReturns, utcDay, type SnapshotRow } from './equityCurve';

const row = (day: string, equity: number, over: Partial<SnapshotRow> = {}): SnapshotRow =>
    ({ day, equity, balance: equity, realised: 0, trades: 0, ...over });

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };

console.log('equityCurve');

test('an empty history is not an error', () => {
    const c = buildCurve([]);
    assert.deepEqual(c.points, []);
    assert.equal(c.startEquity, 0);
    assert.equal(c.maxDrawdown, 0);
    assert.equal(c.bestDay, null);
});

test('drawdown is measured from the running peak, not the start', () => {
    const c = buildCurve([row('2026-01-01', 10000), row('2026-01-02', 12000), row('2026-01-03', 9000), row('2026-01-04', 11000)]);
    assert.equal(c.peakEquity, 12000);
    assert.equal(c.maxDrawdown, 3000);
    assert.equal(c.maxDrawdownPct, 25);
    assert.equal(c.points[1].drawdown, 0);
    assert.equal(c.points[2].drawdown, 3000);
    // The recovery day is still below the old peak.
    assert.equal(c.points[3].drawdown, 1000);
});

test('rows arrive in whatever order and are sorted', () => {
    const c = buildCurve([row('2026-01-03', 9000), row('2026-01-01', 10000), row('2026-01-02', 12000)]);
    assert.deepEqual(c.points.map(p => p.day), ['2026-01-01', '2026-01-02', '2026-01-03']);
    assert.equal(c.endEquity, 9000);
});

test('the first day has no change against a day that does not exist', () => {
    const c = buildCurve([row('2026-01-01', 10000), row('2026-01-02', 10500)]);
    assert.equal(c.points[0].change, 0);
    assert.equal(c.points[0].changePct, null);
    assert.equal(c.points[1].change, 500);
    assert.equal(c.points[1].changePct, 5);
    assert.deepEqual(c.bestDay, { day: '2026-01-02', change: 500 });
    // The first day is not a candidate for best or worst: it moved nothing.
    assert.deepEqual(c.worstDay, { day: '2026-01-02', change: 500 });
});

test('percentages are skipped rather than invented when the base is zero', () => {
    const c = buildCurve([row('2026-01-01', 0), row('2026-01-02', 50)]);
    assert.equal(c.changePct, null);
    assert.equal(c.points[1].changePct, null);
    assert.equal(c.maxDrawdownPct, 0);
});

test('a blown account reports a full drawdown without dividing by zero', () => {
    const c = buildCurve([row('2026-01-01', 5000), row('2026-01-02', 0)]);
    assert.equal(c.maxDrawdown, 5000);
    assert.equal(c.maxDrawdownPct, 100);
});

test('totals count trades and realised P/L, and trading days only where trades happened', () => {
    const c = buildCurve([
        row('2026-01-01', 10000, { trades: 2, realised: 120 }),
        row('2026-01-02', 10120, { trades: 0, realised: 0 }),
        row('2026-01-03', 9900, { trades: 3, realised: -220 }),
    ]);
    assert.equal(c.trades, 5);
    assert.equal(c.realised, -100);
    assert.equal(c.tradingDays, 2);
});

test('a month opens where the previous month closed', () => {
    const months = monthlyReturns([
        row('2026-01-30', 10000, { trades: 1, realised: 10 }),
        row('2026-01-31', 11000),
        row('2026-02-01', 11500),
        row('2026-02-27', 12650, { trades: 2, realised: 200 }),
    ]);
    assert.equal(months.length, 2);
    assert.equal(months[0].month, '2026-01');
    assert.equal(months[0].startEquity, 10000);
    assert.equal(months[0].endEquity, 11000);
    assert.equal(months[0].changePct, 10);
    // February opens at January's close (11000), not at its own first row.
    assert.equal(months[1].startEquity, 11000);
    assert.equal(months[1].endEquity, 12650);
    assert.equal(months[1].changePct, 15);
    assert.equal(months[1].trades, 2);
});

test('utcDay is the UTC calendar day, whatever the local zone', () => {
    assert.equal(utcDay(Date.UTC(2026, 8, 12, 23, 59)), '2026-09-12');
    assert.equal(utcDay(Date.UTC(2026, 8, 13, 0, 1)), '2026-09-13');
});

console.log(`\n${passed} passed`);
