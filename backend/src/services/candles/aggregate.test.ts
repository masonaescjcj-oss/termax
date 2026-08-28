/**
 * Chart-feed aggregation tests.
 *
 * The bug being fixed: a 4-hour chart was served 60-minute bars, and the
 * client kept the first bar of each 4-hour bucket and discarded the other
 * three. So the tests care about two things — that no bar is thrown away,
 * and that the folded candle's OHLC is the bucket's, not the first bar's.
 *
 * Run with:  npx ts-node src/services/candles/aggregate.test.ts
 */

import {
    aggregateCandles, nativeIntervalMs, servedInterval, INTERVAL_MS, RawCandle,
} from './aggregate';

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
function truthy(name: string, got: boolean) { check(name, got, true); }
function section(t: string) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`); }

const HOUR = 3_600_000;
// A UTC midnight, so hourly bars align to 4h boundaries cleanly.
const T0 = Date.UTC(2026, 4, 11, 0, 0, 0);

/** `n` hourly bars whose closes follow `closes`. */
const hourly = (closes: number[]): RawCandle[] => closes.map((c, i) => ({
    timestamp: new Date(T0 + i * HOUR),
    open: i === 0 ? closes[0] : closes[i - 1],
    high: Math.max(c, i === 0 ? closes[0] : closes[i - 1]) + 1,
    low: Math.min(c, i === 0 ? closes[0] : closes[i - 1]) - 1,
    close: c,
    volume: 10,
}));

// ── the bug ─────────────────────────────────────────────────────────
section('the 4h chart served 60m bars');

// Eight hourly bars = exactly two 4-hour candles.
const eight = hourly([100, 103, 99, 105, 104, 108, 102, 110]);
const fourH = aggregateCandles(eight, '4h');

check('eight hourly bars fold into two 4h candles', fourH.length, 2);
check('nothing is discarded — volume is the sum', fourH[0].volume + fourH[1].volume, 80);

// First bucket: bars 0..3, closes 100,103,99,105.
// open = first bar's open = 100; close = last bar's close = 105.
// high = max over bars = max(103,105)+1 = 106; low = min = 99-1 = 98.
check('open comes from the first bar of the bucket', fourH[0].open, 100);
check('close from the LAST bar, not the first', fourH[0].close, 105);
check('high is the bucket extreme', fourH[0].high, 106);
check('low is the bucket extreme', fourH[0].low, 98);
check('and it is stamped at the bucket boundary', fourH[0].timestamp.getTime(), T0);

// This is the assertion that fails under the old dedupe behaviour, which
// kept bar 0 whole: its close was 103 and its high 104.
truthy('the folded candle is not merely the first bar of the bucket',
    fourH[0].close !== eight[0].close || fourH[0].high !== eight[0].high);

// Second bucket: bars 4..7, closes 104,108,102,110.
check('the second bucket opens where its first bar opened', fourH[1].open, 105);
check('and closes on its last bar', fourH[1].close, 110);
check('with the right extreme', fourH[1].high, 111);
check('and is one bucket later', fourH[1].timestamp.getTime() - fourH[0].timestamp.getTime(), 4 * HOUR);

// ── a partial bucket ────────────────────────────────────────────────
section('a partial bucket is still a candle');

// Six hourly bars: a full 4h candle plus a 2-hour remainder.
const six = aggregateCandles(hourly([100, 101, 102, 103, 104, 105]), '4h');
check('six bars give two candles', six.length, 2);
check('the last one holds only what exists', six[1].volume, 20);
check('and closes on the newest bar', six[1].close, 105);

// ── pass-through cases ──────────────────────────────────────────────
section('matching or coarser data passes through');

const asHourly = aggregateCandles(eight, '1h');
check('hourly data on an hourly chart is unchanged in count', asHourly.length, 8);
check('with its own closes intact', asHourly.map(c => c.close).join(','), '100,103,99,105,104,108,102,110');
check('and its volume untouched', asHourly[3].volume, 10);

// Daily bars requested as 15m: aggregation cannot invent detail, and must
// not duplicate or drop anything either.
const daily: RawCandle[] = [0, 1, 2].map(i => ({
    timestamp: new Date(T0 + i * 86_400_000),
    open: 100 + i, high: 110 + i, low: 90 + i, close: 105 + i, volume: 1000,
}));
const asFifteen = aggregateCandles(daily, '15m');
check('three daily bars stay three', asFifteen.length, 3);
check('unchanged', asFifteen[1].close, 106);

// ── bad data ────────────────────────────────────────────────────────
section('a NaN must never reach the chart');

// Yahoo returns nulls for illiquid minutes. A NaN price draws nothing,
// which looks like missing data without admitting to it.
const dirty: any[] = [
    { timestamp: new Date(T0), open: 100, high: 101, low: 99, close: 100, volume: 5 },
    { timestamp: new Date(T0 + HOUR), open: null, high: null, low: null, close: 101, volume: 5 },
    { timestamp: new Date(T0 + 2 * HOUR), open: 101, high: 102, low: 100, close: 102, volume: 5 },
    { timestamp: new Date(T0 + 3 * HOUR), open: 102, high: NaN, low: 101, close: 103, volume: 5 },
    { timestamp: 'not a date', open: 1, high: 2, low: 0, close: 1, volume: 5 },
];
const cleaned = aggregateCandles(dirty, '1h');
check('only the whole bars survive', cleaned.length, 2);
truthy('and every price is finite', cleaned.every(c =>
    [c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite)));
check('a missing volume counts as zero, not NaN',
    aggregateCandles([{ timestamp: new Date(T0), open: 1, high: 2, low: 0, close: 1 }], '1h')[0].volume, 0);

check('an empty series aggregates to nothing', aggregateCandles([], '4h').length, 0);
check('an unknown interval passes data through rather than dropping it',
    aggregateCandles(eight, '3h' as any).length, 8);

// ── out-of-order input ──────────────────────────────────────────────
section('order of arrival does not matter');

const shuffled = [eight[5], eight[0], eight[7], eight[2], eight[1], eight[6], eight[3], eight[4]];
const fromShuffled = aggregateCandles(shuffled, '4h');
check('same candle count from shuffled input', fromShuffled.length, 2);
check('same open', fromShuffled[0].open, fourH[0].open);
check('same close — the last bar by time, not by arrival', fromShuffled[0].close, fourH[0].close);
check('same high', fromShuffled[0].high, fourH[0].high);
check('output is sorted', fromShuffled[0].timestamp.getTime() < fromShuffled[1].timestamp.getTime(), true);

// ── native spacing ──────────────────────────────────────────────────
section('what interval is this data, really?');

check('hourly bars read as an hour', nativeIntervalMs(eight), HOUR);
check('daily bars read as a day', nativeIntervalMs(daily), 86_400_000);
check('too few bars to tell', nativeIntervalMs(eight.slice(0, 2)), null);
check('none at all', nativeIntervalMs([]), null);

// A weekend gap must not make hourly data look daily — hence the median.
const withGap = [
    ...hourly([100, 101, 102, 103, 104]),
    { timestamp: new Date(T0 + 5 * HOUR + 3 * 86_400_000), open: 104, high: 105, low: 103, close: 105, volume: 10 },
];
check('one long gap does not move the median', nativeIntervalMs(withGap), HOUR);

section('and what can be served honestly');

check('hourly data can serve a 4h chart', servedInterval(eight, '4h'), '4h');
check('and an hourly one', servedInterval(eight, '1h'), '1h');
// Daily data cannot fill a 15-minute chart; saying so beats drawing one
// bar per day on a 15-minute axis and letting it pass for the market.
check('daily data cannot serve 15m — it says what it is', servedInterval(daily, '15m'), '1d');
check('nor 1h', servedInterval(daily, '1h'), '1d');
check('but it serves a daily chart', servedInterval(daily, '1d'), '1d');
check('and a weekly one, by folding', servedInterval(daily, '1w'), '1w');
check('with too little data, the request stands', servedInterval(eight.slice(0, 2), '4h'), '4h');

// ── the intervals the app offers ────────────────────────────────────
section('every offered interval has a width');

for (const i of ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']) {
    truthy(`${i} is known`, Number.isFinite(INTERVAL_MS[i]));
}
// Each divides the day evenly (or is the week), so buckets land on real
// session boundaries rather than drifting.
for (const i of ['1m', '5m', '15m', '30m', '1h', '4h', '1d']) {
    check(`${i} divides a day evenly`, 86_400_000 % INTERVAL_MS[i], 0);
}

// ── report ──────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(64)}`);
if (failures.length) {
    console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
    failures.forEach(f => console.log(`  ✗ ${f}\n`));
    process.exit(1);
}
console.log(`✅ all ${passed} assertions passed`);
