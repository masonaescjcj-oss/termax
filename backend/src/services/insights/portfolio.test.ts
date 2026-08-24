/**
 * Portfolio risk tests. Every expectation is arithmetic done by hand from
 * the contract specs — 1.00 EUR/USD is 100,000 EUR, a pip is $10, and so
 * on — so a wrong answer here means the engine is wrong, not the fixture.
 *
 * Run with:  npx ts-node src/services/insights/portfolio.test.ts
 */

import { setQuote } from '../pricing';
import { Bar } from '../strategy/types';
import {
    currencyExposure, stopRisk, pearson, correlations, clusterBySymbol,
    portfolioFindings, buildPortfolioReport, positionValue,
    OpenPositionLike, MIN_CORR_DAYS, SAME_BET_R,
} from './portfolio';

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

// Quotes the conversion layer needs. Mids: EUR/USD 1.1000, GBP/USD 1.2700,
// AUD/USD 0.6500, USD/JPY 155.00, GOLD 2400.00.
setQuote('EUR/USD', 1.09995, 1.10005);
setQuote('GBP/USD', 1.26995, 1.27005);
setQuote('AUD/USD', 0.64995, 0.65005);
setQuote('USD/JPY', 154.995, 155.005);
setQuote('GOLD', 2399.90, 2400.10);

const pos = (
    id: string, symbol: string, side: 'BUY' | 'SELL', volume: number,
    entryPrice: number, stopLoss: number | null = null
): OpenPositionLike => ({ id, symbol, side, volume, entryPrice, stopLoss });

// ── position value ──────────────────────────────────────────────────
section('one position, valued exactly');

// 1.00 lot EUR/USD = 100,000 EUR; EUR->USD at 1.1000 = $110,000.
check('EUR/USD 1.00 lot is $110,000', positionValue(pos('p', 'EUR/USD', 'BUY', 1, 1.10))!, 110_000, 1);
// 0.50 lot = 50,000 EUR = $55,000.
check('and half of that at 0.50', positionValue(pos('p', 'EUR/USD', 'BUY', 0.5, 1.10))!, 55_000, 1);
// GOLD: 100 oz per lot at 2400 = $240,000. XAU has no direct rate, so the
// quote leg is valued instead — the same money.
check('GOLD 1.00 lot is $240,000', positionValue(pos('p', 'GOLD', 'BUY', 1, 2400))!, 240_000, 1);
// USD/JPY: base is USD, so 1.00 lot is simply $100,000.
check('USD/JPY 1.00 lot is $100,000', positionValue(pos('p', 'USD/JPY', 'BUY', 1, 155))!, 100_000, 1);
// getSpec never returns undefined — an unknown symbol fail-softs to a
// single-unit CFD, which is a deliberate choice elsewhere in this codebase.
// So the unvaluable case is not a missing spec but a missing *rate*: an
// exotic pair with no cross quoted against the account currency.
// The fallback spec is a USD-denominated single unit (contractSize 1),
// so its notional is the volume and does not use the price at all. That
// understates a real stock CFD, whose notional is price x shares — but
// the fallback exists for symbols we have no spec for, and changing
// notionalInBase would move margin and P/L for every CFD in the app.
// Recorded here rather than papered over.
check('an unknown symbol falls back to one USD-denominated unit',
    positionValue(pos('p', 'NOPE/XYZ', 'BUY', 1, 42))!, 1, 0.01);
check('and scales with volume, not with price',
    positionValue(pos('p', 'NOPE/XYZ', 'BUY', 3, 42))!, 3, 0.01);
check('but a pair with no convertible currency has no value',
    positionValue(pos('p', 'TRY/SEK', 'BUY', 1, 3.5)), undefined);

// ── the case this module exists for ─────────────────────────────────
section('three longs against the dollar are one bet');

const dollarShort = [
    pos('a', 'EUR/USD', 'BUY', 1, 1.10),   // $110,000
    pos('b', 'GBP/USD', 'BUY', 1, 1.27),   // $127,000
    pos('c', 'AUD/USD', 'BUY', 1, 0.65),   // $65,000
];
let exp = currencyExposure(dollarShort);

// Book = 110,000 + 127,000 + 65,000 = 302,000.
check('the book is the sum of the notionals', exp.gross, 302_000, 1);
check('nothing was skipped', exp.skipped.length, 0);

const leg = (c: string) => exp.legs.find(l => l.currency === c)!;
// Every long is short the dollar: -(110 + 127 + 65) thousand.
check('the dollar leg nets all three', leg('USD').exposure, -302_000, 1);
check('and is the largest leg', exp.legs[0].currency, 'USD');
// 302,000 / 302,000 — the whole book is one bet on the dollar.
check('which is 100% of the book', leg('USD').sharePct, 100);
check('EUR is only part of it', leg('EUR').exposure, 110_000, 1);
// 110,000 / 302,000 = 36.4%.
check('at 36.4%', leg('EUR').sharePct, 36.4, 0.1);
check('GBP too', leg('GBP').sharePct, 42.1, 0.1);   // 127/302
check('and AUD', leg('AUD').sharePct, 21.5, 0.1);   // 65/302
check('all three symbols are named on the dollar leg', leg('USD').symbols.length, 3);

// The shares deliberately do not sum to 100 — every position has two legs.
const shareSum = exp.legs.reduce((s, l) => s + l.sharePct, 0);
truthy('shares sum to about 200, not 100, because each position has two legs',
    shareSum > 195 && shareSum < 205);

section('a hedged book reads as hedged');

// Long EUR/USD, short GBP/USD: the dollar legs mostly cancel.
exp = currencyExposure([
    pos('a', 'EUR/USD', 'BUY', 1, 1.10),    // USD -110,000
    pos('b', 'GBP/USD', 'SELL', 1, 1.27),   // USD +127,000
]);
// -110,000 + 127,000 = +17,000 on a book of 237,000 = 7.2%.
check('dollar exposure nets out', exp.legs.find(l => l.currency === 'USD')!.exposure, 17_000, 1);
check('to 7.2% of the book', exp.legs.find(l => l.currency === 'USD')!.sharePct, 7.2, 0.1);
check('and the real bet is GBP', exp.legs[0].currency, 'GBP');
// 127,000 / 237,000 = 53.6%.
check('at 53.6%', exp.legs[0].sharePct, 53.6, 0.1);
check('short, so negative', exp.legs[0].exposure, -127_000, 1);

section('a single position');

exp = currencyExposure([pos('a', 'EUR/USD', 'BUY', 1, 1.10)]);
check('is 100% of itself on both legs', exp.legs[0].sharePct, 100);
check('and its book is its own notional', exp.gross, 110_000, 1);
check('an empty book has no legs', currencyExposure([]).legs.length, 0);
check('and no size', currencyExposure([]).gross, 0);

exp = currencyExposure([pos('a', 'TRY/SEK', 'BUY', 1, 3.5), pos('b', 'EUR/USD', 'BUY', 1, 1.10)]);
check('an unvaluable position is reported, not dropped', exp.skipped.join(','), 'TRY/SEK');
check('and does not corrupt the book', exp.gross, 110_000, 1);
truthy('nor appear as a currency leg', !exp.legs.some(l => l.currency === 'TRY'));

// ── risk if every stop is hit ───────────────────────────────────────
section('risk if every stop is hit');

// EUR/USD 1.00 lot: pip = 100,000 x 0.0001 = $10. Entry 1.1000, stop
// 1.0950 = 50 pips = $500.
let risk = stopRisk([pos('a', 'EUR/USD', 'BUY', 1, 1.10, 1.0950)]);
check('50 pips at $10 a pip is $500', risk.ifAllStopsHit, 500, 0.01);
check('and it is attributed to the position', risk.perPosition[0].risk, 500, 0.01);
check('with no unstopped positions', risk.unstopped.length, 0);

// A short's stop is above entry: 1.1050 - 1.1000 = 50 pips = $500.
risk = stopRisk([pos('a', 'EUR/USD', 'SELL', 1, 1.10, 1.1050)]);
check('a short stop above entry risks the same', risk.ifAllStopsHit, 500, 0.01);

// Two positions add up: $500 + (0.5 lot, 30 pips, $5/pip) = $500 + $150.
risk = stopRisk([
    pos('a', 'EUR/USD', 'BUY', 1, 1.10, 1.0950),
    pos('b', 'EUR/USD', 'BUY', 0.5, 1.10, 1.0970),
]);
check('the all-stops-hit total adds up', risk.ifAllStopsHit, 650, 0.01);
check('and the biggest risk is listed first', risk.perPosition[0].risk, 500, 0.01);

// GOLD: 100 oz per lot, pip 0.01 → $1/pip per lot. 0.15 lot = $0.15/pip.
// Entry 2400, stop 2410 on a short = 1000 pips = $150.
risk = stopRisk([pos('a', 'GOLD', 'SELL', 0.15, 2400, 2410)]);
check('gold risk from its own contract size', risk.ifAllStopsHit, 150, 0.01);

// An unstopped position must not be counted as zero risk.
risk = stopRisk([
    pos('a', 'EUR/USD', 'BUY', 1, 1.10, 1.0950),
    pos('b', 'GBP/USD', 'BUY', 1, 1.27, null),
]);
check('the total covers only what has a stop', risk.ifAllStopsHit, 500, 0.01);
check('and the unstopped one is named', risk.unstopped[0].symbol, 'GBP/USD');
check('with a null risk, not a zero', risk.perPosition.find(p => p.symbol === 'GBP/USD')!.risk, null);

// A stop already past entry is in profit; it cannot lose money.
risk = stopRisk([pos('a', 'EUR/USD', 'BUY', 1, 1.10, 1.1050)]);
check('a stop in profit risks nothing, not a negative', risk.ifAllStopsHit, 0);

// ── correlation ─────────────────────────────────────────────────────
section('pearson, by hand');

check('a perfect line is 1', pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]), 1, 1e-9);
check('reversed is -1', pearson([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]), -1, 1e-9);
// mx=2, my=2; dev x = -1,0,1; dev y = -1,1,0 → num = 1, dx = 2, dy = 2.
check('and a mixed case is 0.5', pearson([1, 2, 3], [1, 3, 2]), 0.5, 1e-9);
truthy('one point is not a correlation', Number.isNaN(pearson([1], [1])));
truthy('a flat series has none either', Number.isNaN(pearson([2, 2, 2], [1, 2, 3])));

section('correlation over stored candles');

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 1);
/** Daily bars whose closes follow `closes`. */
const series = (closes: number[]): Bar[] => closes.map((c, i) => ({
    time: T0 + i * DAY, open: c, high: c, low: c, close: c, volume: 1,
}));

// 60 days of returns that agree exactly, and one that is their mirror.
const up: number[] = [100];
for (let i = 1; i < 61; i++) up.push(up[i - 1] * (1 + (i % 3 === 0 ? 0.01 : i % 3 === 1 ? -0.004 : 0.006)));
const mirror: number[] = [50];
for (let i = 1; i < 61; i++) mirror.push(mirror[i - 1] * (1 - (i % 3 === 0 ? 0.01 : i % 3 === 1 ? -0.004 : 0.006)));

const bars: Record<string, Bar[]> = {
    'EUR/USD': series(up),
    'GBP/USD': series(up),          // identical returns
    'USD/CHF': series(mirror),      // exactly opposite
    'GOLD': series(up.map((v, i) => v * (1 + (i % 7) * 0.0005))),
};
const barsFor = (s: string) => bars[s] ?? [];

let pairs = correlations(['EUR/USD', 'GBP/USD', 'USD/CHF'], { barsFor, now: T0 + 61 * DAY });
const pair = (a: string, b: string) => pairs.find(p => (p.a === a && p.b === b) || (p.a === b && p.b === a))!;

check('identical return series correlate at 1', pair('EUR/USD', 'GBP/USD').r, 1, 0.01);
check('mirrored series at -1', pair('EUR/USD', 'USD/CHF').r, -1, 0.01);
check('60 closes give 60 paired returns', pair('EUR/USD', 'GBP/USD').days, 60);
check('and the strongest pair is reported first', Math.abs(pairs[0].r), 1, 0.01);

// Below the floor, no coefficient is reported at all.
const shortBars: Record<string, Bar[]> = { A: series(up.slice(0, 12)), B: series(up.slice(0, 12)) };
pairs = correlations(['A', 'B'], { barsFor: (s) => shortBars[s] ?? [], now: T0 + 12 * DAY });
check(`under ${MIN_CORR_DAYS} paired days nothing is claimed`, pairs.length, 0);

// Dates that do not overlap must not be paired against each other.
const offset: Record<string, Bar[]> = {
    A: series(up),
    B: up.map((c, i) => ({ time: T0 + (i + 500) * DAY, open: c, high: c, low: c, close: c, volume: 1 })),
};
pairs = correlations(['A', 'B'], { barsFor: (s) => offset[s] ?? [], now: T0 + 600 * DAY });
check('no shared dates, no correlation', pairs.length, 0);

check('one symbol has nothing to correlate with',
    correlations(['EUR/USD'], { barsFor, now: T0 + 61 * DAY }).length, 0);
check('a symbol with no candles is simply absent',
    correlations(['EUR/USD', 'GBP/USD', 'MISSING'], { barsFor, now: T0 + 61 * DAY })
        .some(p => p.a === 'MISSING' || p.b === 'MISSING'), false);

// ── clustering ──────────────────────────────────────────────────────
section('clustering: how many bets is this really?');

let clusters = clusterBySymbol(
    ['EUR/USD', 'GBP/USD', 'USD/JPY'],
    [
        { a: 'EUR/USD', b: 'GBP/USD', r: 0.92, days: 60 },
        { a: 'EUR/USD', b: 'USD/JPY', r: 0.11, days: 60 },
        { a: 'GBP/USD', b: 'USD/JPY', r: 0.09, days: 60 },
    ],
);
check('two clusters', clusters.length, 2);
check('the correlated pair is one bet', clusters[0].join('+'), 'EUR/USD+GBP/USD');
check('the uncorrelated one stands alone', clusters[1].join('+'), 'USD/JPY');

// Single-link: A~B and B~C puts all three together even with no A~C.
clusters = clusterBySymbol(
    ['A', 'B', 'C'],
    [{ a: 'A', b: 'B', r: 0.8, days: 60 }, { a: 'B', b: 'C', r: 0.8, days: 60 }, { a: 'A', b: 'C', r: 0.2, days: 60 }],
);
check('a chain links into one cluster', clusters[0].join('+'), 'A+B+C');

// A strong *negative* correlation is the same bet held both ways round.
clusters = clusterBySymbol(['A', 'B'], [{ a: 'A', b: 'B', r: -0.95, days: 60 }]);
check('a strong inverse pair is also one bet', clusters[0].length, 2);

clusters = clusterBySymbol(['A', 'B'], [{ a: 'A', b: 'B', r: 0.5, days: 60 }]);
check(`below ${SAME_BET_R} they stay separate`, clusters.length, 2);
check('no symbols, no clusters', clusterBySymbol([], []).length, 0);

// ── the findings ────────────────────────────────────────────────────
section('the findings say it in Persian, from the numbers');

let report = buildPortfolioReport(dollarShort, { equity: 10_000, barsFor, now: T0 + 61 * DAY });
const find = (k: string) => report.findings.find(f => f.key === k);

truthy('concentration is called out', !!find('concentration'));
check('as an alert at 100%', find('concentration')!.severity, 'ALERT');
truthy('naming the dollar', find('concentration')!.fa.includes('دلار'));
truthy('and the direction', find('concentration')!.fa.includes('فروش'));
truthy('and the position count', find('concentration')!.fa.includes('3 پوزیشن'));

truthy('unstopped positions are an alert', find('unstopped')!.severity === 'ALERT');
truthy('naming all three', find('unstopped')!.evidence.count === 3);
truthy('and saying their loss is not in the total',
    find('unstopped')!.fa.includes('عدد ندارد'));

// Alerts before warnings before info.
const sevs = report.findings.map(f => f.severity);
truthy('alerts come first', sevs.indexOf('ALERT') <= (sevs.indexOf('WARN') === -1 ? 99 : sevs.indexOf('WARN')));

// With stops, the all-stops-hit line appears with its percentage.
report = buildPortfolioReport([
    pos('a', 'EUR/USD', 'BUY', 1, 1.10, 1.0950),   // $500
    pos('b', 'GBP/USD', 'BUY', 1, 1.27, 1.2600),   // 100 pips x $10 = $1,000
], { equity: 10_000, barsFor, now: T0 + 61 * DAY });
check('the stop risk totals both', report.risk.ifAllStopsHit, 1500, 0.01);
// Thousands separated and no cents above $1,000: these sentences carry
// six-figure exposures and have to stay readable.
truthy('and is stated as money a sentence can carry', find('stopRisk')!.fa.includes('$1,500'));
truthy('without cents at that size', !find('stopRisk')!.fa.includes('$1,500.00'));
// 1500 / 10,000 = 15%.
truthy('with its share of the account', find('stopRisk')!.fa.includes('15٪'));
check('which at 15% is a warning', find('stopRisk')!.severity, 'WARN');
truthy('no unstopped finding when everything has a stop', !find('unstopped'));

// Without an equity figure the percentage is omitted rather than invented.
report = buildPortfolioReport([pos('a', 'EUR/USD', 'BUY', 1, 1.10, 1.0950)], { barsFor, now: T0 + 61 * DAY });
truthy('no equity, no percentage', !find('stopRisk')!.fa.includes('٪'));
truthy('but still the money', find('stopRisk')!.fa.includes('$500.00'));

// A single position must not be scolded for being 100% concentrated.
report = buildPortfolioReport([pos('a', 'EUR/USD', 'BUY', 1, 1.10, 1.0950)], { barsFor, now: T0 + 61 * DAY });
truthy('one position is not a concentration finding', !find('concentration'));

// The cluster finding needs both the correlation and the pair behind it.
report = buildPortfolioReport([
    pos('a', 'EUR/USD', 'BUY', 1, 1.10, 1.0950),
    pos('b', 'GBP/USD', 'BUY', 1, 1.27, 1.2600),
], { equity: 10_000, barsFor, now: T0 + 61 * DAY });
const cluster = report.findings.find(f => f.key.startsWith('cluster:'));
truthy('a correlated pair is reported as one bet', !!cluster);
truthy('with the coefficient', cluster!.fa.includes('1'));
truthy('and the sample size, never without it', cluster!.fa.includes('60 روز'));
check('and its severity is a warning', cluster!.severity, 'WARN');

// An empty book must produce a report, not an exception.
report = buildPortfolioReport([], { equity: 10_000 });
check('an empty book has no findings', report.findings.length, 0);
check('and no positions', report.positions, 0);
check('and names the account currency', report.accountCurrency, 'USD');

// ── report ──────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(64)}`);
if (failures.length) {
    console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
    failures.forEach(f => console.log(`  ✗ ${f}\n`));
    process.exit(1);
}
console.log(`✅ all ${passed} assertions passed`);
