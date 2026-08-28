/**
 * Journal page tests — the calendar, the auto-written entry, the habit
 * table, and the discipline streak.
 *
 * Every expectation here is arithmetic done by hand. The Jalali dates are
 * checked against Nowruz anchors (Farvardin 1 = 21 March 2026 for 1405,
 * 21 March 2025 for 1404, 20 March 2024 for 1403) plus an exhaustive
 * round-trip over 51 years, which is what caught the leap-year bug in
 * d2j's pre-Nowruz branch.
 *
 * Run with:  npx ts-node src/services/insights/journalPages.test.ts
 */

import {
    d2j, g2d, j2d, toJalali, toGregorianDay, formatJalali, faDigits,
    isJalaliLeap, jalaliMonthLength, jalaliWeekday,
} from './jalali';
import { JournalTags } from './journal';
import {
    autoTags, breaksDiscipline, renderEntry, renderDayRecap, resultPips, stopPipsOf, TAG_META,
} from './journalEntry';
import {
    buildMonth, computeStreak, localDayKey, monthDayKeys, sliceByTag, sliceByEmotion,
    JournalRow, dayLabelFa,
} from './journalCalendar';

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

const MIN = 60_000;
const DAY = 86_400_000;

// ── Jalali calendar ─────────────────────────────────────────────────
section('jalali: Nowruz anchors');

const jstr = (iso: string) => { const r = toJalali(iso); return `${r.jy}/${r.jm}/${r.jd}`; };

check('1405 begins on 21 March 2026', jstr('2026-03-21'), '1405/1/1');
check('1404 begins on 21 March 2025', jstr('2025-03-21'), '1404/1/1');
check('1403 begins on 20 March 2024', jstr('2024-03-20'), '1403/1/1');
check('1399 begins on 20 March 2020', jstr('2020-03-20'), '1399/1/1');

// 1404 spans 21 Mar 2025 → 20 Mar 2026 = 365 days, so it is a common
// year and its Esfand has 29 days: the last day is 1404/12/29.
check('day before Nowruz 1405 is 1404/12/29', jstr('2026-03-20'), '1404/12/29');
check('1404 is not a leap year', isJalaliLeap(1404), false);
check('Esfand 1404 has 29 days', jalaliMonthLength(1404, 12), 29);

// 1403 spans 20 Mar 2024 → 20 Mar 2025 = 366 days, so Esfand 1403 has 30.
check('day before Nowruz 1404 is 1403/12/30', jstr('2025-03-20'), '1403/12/30');
check('1403 is a leap year', isJalaliLeap(1403), true);
check('Esfand 1403 has 30 days', jalaliMonthLength(1403, 12), 30);

// 24 Aug 2026: day-of-year 236 minus day-of-year 80 (21 Mar) = 156 days
// after 1405/1/1. Months 1-6 are 31 days each, so day 155 is 6/1 and
// day 156 is 6/2.
check('24 Aug 2026 is 2 Shahrivar 1405', jstr('2026-08-24'), '1405/6/2');
check('and formats in Persian digits', formatJalali('2026-08-24'), '۲ شهریور ۱۴۰۵');
check('first six months are 31 days', jalaliMonthLength(1405, 1) + jalaliMonthLength(1405, 6), 62);
check('months 7-11 are 30 days', jalaliMonthLength(1405, 7) + jalaliMonthLength(1405, 11), 60);

section('jalali: exhaustive round-trip');
let rtDays = 0, rtBad = 0;
for (let d = g2d(1990, 1, 1); d <= g2d(2040, 12, 31); d++) {
    const r = d2j(d);
    rtDays++;
    if (j2d(r.jy, r.jm, r.jd) !== d) rtBad++;
}
check('51 years of days round-trip', rtBad, 0);
truthy('and that is a real sweep, not an empty loop', rtDays > 18_000);
check('gregorian round-trip too', toGregorianDay(1405, 6, 2), '2026-08-24');

// 24 Aug 2026 was a Monday. Persian weeks start on Saturday, so
// Saturday=0, Sunday=1, Monday=2.
check('Saturday-first weekday index', jalaliWeekday('2026-08-24'), 2);
check('the Saturday before it is 0', jalaliWeekday('2026-08-22'), 0);
check('persian digits', faDigits('1405-06'), '۱۴۰۵-۰۶');
check('day label carries the weekday', dayLabelFa('2026-08-24'), '۲ شهریور ۱۴۰۵ (دوشنبه)');

// ── auto tags ───────────────────────────────────────────────────────
section('auto tags are measured, not guessed');

const ctxOf = (over: Partial<JournalTags> = {}): JournalTags => ({
    trend: 'UP', volatility: 'NORMAL', session: 'london', withTrend: true,
    evidence: { emaSlopeAtr: 0.6, atrPips: 20, atrRatio: 1.0, hourUtc: 10, timeframe: '5m', bars: 120 },
    ...over,
});

const T0 = Date.UTC(2026, 7, 24, 10, 0, 0);
const baseTrade = {
    symbol: 'EUR/USD', side: 'BUY' as const, volume: 0.1,
    entryPrice: 1.10000, closePrice: 1.10200,
    openTime: T0, closeTime: T0 + 34 * MIN, netProfit: 18.4,
    stopLoss: 1.09800, takeProfit: 1.10400,
};

// EUR/USD pip = 0.0001. Close 1.10200 - entry 1.10000 = 0.00200 = 20 pips.
check('result pips from price, not from money', resultPips(baseTrade), 20);
// |1.10000 - 1.09800| = 0.00200 = 20 pips.
check('stop distance in pips', stopPipsOf(baseTrade), 20);
check('no stop reads as null, not as zero', stopPipsOf({ ...baseTrade, stopLoss: null }), null);

let tags = autoTags(baseTrade, ctxOf());
truthy('a stop plus a target is planned', tags.includes('planned'));
truthy('BUY in an uptrend is with the trend', tags.includes('withTrend'));
truthy('nothing risky here', !tags.some(t => breaksDiscipline([t])));

// Stop 20 pips against an ATR of 20: 20 >= 0.5*20, so not tight.
check('a stop at 1.0 ATR is not tight', autoTags(baseTrade, ctxOf()).includes('tightStop'), false);
// Stop 1.09950 → 5 pips, against ATR 20: 5 < 10, so tight.
truthy('a stop at 0.25 ATR is tight',
    autoTags({ ...baseTrade, stopLoss: 1.09950 }, ctxOf()).includes('tightStop'));

tags = autoTags({ ...baseTrade, stopLoss: null }, ctxOf());
truthy('no stop is tagged', tags.includes('noStop'));
truthy('and no stop cannot also be a tight stop', !tags.includes('tightStop'));
truthy('and no stop cannot be planned', !tags.includes('planned'));
truthy('no stop breaks discipline', breaksDiscipline(tags));

// Revenge: previous trade closed at a loss 11 minutes before this entry.
tags = autoTags(baseTrade, ctxOf(), { prevCloseTime: T0 - 11 * MIN, prevWasLoss: true });
truthy('11 minutes after a loss is revenge', tags.includes('revenge'));
truthy('revenge breaks discipline', breaksDiscipline(tags));
check('31 minutes after a loss is not',
    autoTags(baseTrade, ctxOf(), { prevCloseTime: T0 - 31 * MIN, prevWasLoss: true }).includes('revenge'), false);
check('11 minutes after a WIN is not revenge',
    autoTags(baseTrade, ctxOf(), { prevCloseTime: T0 - 11 * MIN, prevWasLoss: false }).includes('revenge'), false);

// Oversize: median 0.10, so 1.5x is 0.15. 0.15 qualifies, 0.14 does not.
truthy('1.5x the usual size is oversized',
    autoTags({ ...baseTrade, volume: 0.15 }, ctxOf(), { medianVolume: 0.1 }).includes('oversize'));
check('1.4x is not', autoTags({ ...baseTrade, volume: 0.14 }, ctxOf(), { medianVolume: 0.1 }).includes('oversize'), false);
check('and with no median we do not guess',
    autoTags({ ...baseTrade, volume: 5 }, ctxOf(), {}).includes('oversize'), false);

tags = autoTags({ ...baseTrade, side: 'SELL' }, ctxOf({ withTrend: false, volatility: 'WILD', session: 'offHours' }));
truthy('counter-trend tagged', tags.includes('counterTrend'));
truthy('wild volatility tagged', tags.includes('wildVol'));
truthy('off hours tagged', tags.includes('offHours'));
truthy('none of those three is a discipline failure — they are choices',
    !tags.some(t => breaksDiscipline([t])));

// Thin history: 40 bars is below the 60-bar floor, so no regime tag.
tags = autoTags(baseTrade, ctxOf({ evidence: { ...ctxOf().evidence, bars: 40 } }));
truthy('thin history yields no trend tag', !tags.includes('withTrend'));
truthy('nor a volatility tag', !tags.includes('wildVol') && !tags.includes('quietVol'));
truthy('but the stop is still known', tags.includes('planned'));

// ── the written entry ───────────────────────────────────────────────
section('the entry says only what is known');

let entry = renderEntry(baseTrade, ctxOf());
truthy('names the direction and instrument', entry.fa.includes('خرید 0.1 EUR/USD'));
truthy('names the session', entry.fa.includes('سشن لندن'));
truthy('names the regime and the alignment', entry.fa.includes('روند صعودی و هم‌جهت با آن'));
truthy('names the hold time', entry.fa.includes('34 دقیقه'));
truthy('names the pips', entry.fa.includes('20 پیپ سود'));
truthy('and the money', entry.fa.includes('$18.40'));
truthy('no regime caveat when the regime is known', !entry.fa.includes('کندل کافی'));

entry = renderEntry({ ...baseTrade, closePrice: 1.09800, netProfit: -21.6 }, ctxOf());
truthy('a loss is written as a loss', entry.fa.includes('20 پیپ ضرر'));
truthy('with a signed amount', entry.fa.includes('-$21.60'));

entry = renderEntry(baseTrade, ctxOf({ evidence: { ...ctxOf().evidence, bars: 20 } }));
truthy('thin history is admitted in words', entry.fa.includes('کندل کافی'));
truthy('and the regime clause is dropped, not guessed', !entry.fa.includes('روند صعودی'));
truthy('while the trade facts survive', entry.fa.includes('20 پیپ سود'));

entry = renderEntry(baseTrade, ctxOf(), { verdictFa: 'حد ضررت ۵ پیپ بود.', verdictEn: 'Your stop was 5 pips.' });
truthy('an engine verdict is appended verbatim', entry.fa.endsWith('حد ضررت ۵ پیپ بود.'));
truthy('english mirrors it', entry.en.includes('Your stop was 5 pips.'));

// A 3-hour hold: 180 minutes → "3 ساعت".
entry = renderEntry({ ...baseTrade, closeTime: T0 + 180 * MIN }, ctxOf());
truthy('hours once past 60 minutes', entry.fa.includes('3 ساعت'));
// A 2-day hold: 2880 minutes → "2 روز".
entry = renderEntry({ ...baseTrade, closeTime: T0 + 2880 * MIN }, ctxOf());
truthy('days once past a day', entry.fa.includes('2 روز'));

// ── the day recap ───────────────────────────────────────────────────
section('day recap counts before it speaks');

const rec = renderDayRecap([
    { netProfit: 61.2, symbol: 'GOLD', side: 'SELL', tags: ['planned'] },
    { netProfit: -18.75, symbol: 'BTC/USDT', side: 'BUY', tags: ['planned'] },
    { netProfit: 4.8, symbol: 'EUR/USD', side: 'BUY', tags: ['withTrend'] },
]);
// 61.20 - 18.75 + 4.80 = 47.25
truthy('sums the day', rec.fa.includes('$47.25'));
truthy('counts the trades', rec.fa.includes('3 معامله'));
truthy('counts the winners', rec.fa.includes('2 برد'));
truthy('names the best', rec.fa.includes('SELL GOLD'));
truthy('names the worst', rec.fa.includes('BUY BTC/USDT'));
truthy('and calls a clean day clean', rec.fa.includes('روز منظمی بود'));

const recDirty = renderDayRecap([
    { netProfit: -30, symbol: 'GOLD', side: 'SELL', tags: ['revenge', 'noStop'] },
    { netProfit: 10, symbol: 'GOLD', side: 'BUY', tags: ['planned'] },
]);
truthy('a broken day is named as broken', recDirty.fa.includes('در 1 معامله برچسب'));
truthy('and the clause never opens on a digit, which bidi would glue to the money',
    !/^\d/.test(recDirty.fa.split('. ').pop() ?? ''));
truthy('and the tags are listed', recDirty.fa.includes('انتقامی') && recDirty.fa.includes('بدون حد ضرر'));
truthy('never calls it disciplined', !recDirty.fa.includes('روز منظمی بود'));
check('an empty day says so', renderDayRecap([]).fa, 'این روز معامله‌ای بسته نشد.');

// ── the month grid ──────────────────────────────────────────────────
section('the month grid');

// Shahrivar 1405 = 1405/6/1 .. 1405/6/31 = 23 Aug .. 22 Sep 2026.
const keys = monthDayKeys('jalali', 1405, 6);
check('Shahrivar has 31 days', keys.length, 31);
check('and starts on 23 Aug 2026', keys[0], '2026-08-23');
check('and ends on 22 Sep 2026', keys[30], '2026-09-22');

const row = (day: string, net: number, tags: string[] = [], hour = 12): JournalRow => ({
    id: `${day}-${net}`, symbol: 'EUR/USD', side: 'BUY', volume: 0.1, netProfit: net,
    openTime: Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00Z`) - 30 * MIN,
    closeTime: Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00Z`),
    tags,
});

const monthRows: JournalRow[] = [
    row('2026-08-24', 100, ['planned']),
    row('2026-08-24', -40, ['planned']),          // day net +60
    row('2026-08-25', -30, ['revenge']),          // day net -30, broken
    row('2026-08-26', 20, ['withTrend']),         // day net +20
    row('2026-07-30', 999, ['planned']),          // previous month, ignored
];
const month = buildMonth(monthRows, { calendar: 'jalali', year: 1405, month: 6 });

check('month label is Persian', month.monthLabel, 'شهریور ۱۴۰۵');
// 23 Aug 2026 was a Sunday → Saturday-first index 1.
check('grid offset from the first day', month.firstWeekday, 1);
check('31 cells', month.days.length, 31);
check('only this month is counted', month.totals.trades, 4);
// 100 - 40 - 30 + 20 = 50
check('net of the month', month.totals.netProfit, 50);
check('two winners of four', month.totals.wins, 2);
check('win rate', month.totals.winRate, 50);
check('three trading days', month.totals.tradingDays, 3);
check('two green days', month.totals.greenDays, 2);
check('one red day', month.totals.redDays, 1);
check('two clean days', month.totals.cleanDays, 2);
check('best day is the 24th', month.totals.bestDay!.day, '2026-08-24');
check('best day net', month.totals.bestDay!.netProfit, 60);
check('worst day is the 25th', month.totals.worstDay!.day, '2026-08-25');

const cell = (iso: string) => month.days.find(d => d.day === iso)!;
// Peak absolute day is 60, so 60/60 = 1, -30/60 = -0.5, 20/60 = 0.333.
check('intensity is scaled to the month peak', cell('2026-08-24').intensity, 1);
check('and is signed', cell('2026-08-25').intensity, -0.5);
check('and proportional', cell('2026-08-26').intensity, 0.333, 0.001);
check('an untraded day is flat', cell('2026-08-30').intensity, 0);
check('an untraded day is not "clean"', cell('2026-08-30').clean, false);
check('a broken day is not clean', cell('2026-08-25').clean, false);
check('a clean day is', cell('2026-08-24').clean, true);
check('and carries its risk tags', cell('2026-08-25').riskTags.join(','), 'revenge');
check('day labels use Persian digits', cell('2026-08-24').label, '۲');

const empty = buildMonth([], { calendar: 'jalali', year: 1405, month: 6 });
check('an empty month has no peak to divide by', empty.days.every(d => d.intensity === 0), true);
check('and no best day', empty.totals.bestDay, null);
check('and a zero win rate rather than NaN', empty.totals.winRate, 0);

// Timezone: a trade closed 01:30 UTC belongs to the previous Tehran day
// only if we shift it; +3:30 puts it on the same day at 05:00 local.
check('UTC day key', localDayKey(Date.parse('2026-08-25T01:30:00Z'), 0), '2026-08-25');
check('Tehran keeps it on the 25th', localDayKey(Date.parse('2026-08-25T01:30:00Z'), 210), '2026-08-25');
check('but 22:30 UTC is already the 26th in Tehran',
    localDayKey(Date.parse('2026-08-25T22:30:00Z'), 210), '2026-08-26');
check('and New York puts it back on the 25th',
    localDayKey(Date.parse('2026-08-25T22:30:00Z'), -240), '2026-08-25');

// ── discipline streak ───────────────────────────────────────────────
section('the streak rewards process, not profit');

const d = (n: number) => new Date(Date.UTC(2026, 7, n)).toISOString().slice(0, 10);
const streakRows: JournalRow[] = [
    row(d(10), -50, ['revenge']),      // broken
    row(d(11), -80, ['planned']),      // clean, and a losing day
    row(d(12), 30, ['planned']),
    row(d(13), -10, ['withTrend']),
    row(d(17), 5, ['planned']),        // gap of untraded days
];
let st = computeStreak(streakRows);
check('four clean trading days in a row', st.current, 4);
check('a losing day can still be clean', st.best, 4);
check('last day recorded', st.lastDay, d(17));

st = computeStreak([...streakRows, row(d(18), 200, ['oversize'])]);
check('an oversized winner still breaks the streak', st.current, 0);
check('the best run is remembered', st.best, 4);
check('and the streak says what broke it', st.brokenBy!.join(','), 'oversize');

check('no trades, no streak', computeStreak([]).current, 0);
check('and no last day', computeStreak([]).lastDay, null);

// ── the habit table ─────────────────────────────────────────────────
section('what each habit costs');

const habitRows: JournalRow[] = [
    row(d(1), -60, ['revenge', 'noStop']),
    row(d(2), -40, ['revenge']),
    row(d(3), -20, ['revenge']),
    row(d(4), 15, ['revenge']),
    row(d(5), 50, ['planned', 'withTrend']),
    row(d(6), 40, ['planned', 'withTrend']),
    row(d(7), 30, ['planned', 'withTrend']),
    row(d(8), -100, ['noStop', 'wildVol']),
];
const slices = sliceByTag(habitRows);
const byKey = new Map(slices.map(s => [s.key, s]));

// revenge: -60 -40 -20 +15 = -105 over 4 trades, 1 winner.
check('revenge trades counted', byKey.get('revenge')!.trades, 4);
check('revenge bill', byKey.get('revenge')!.netProfit, -105);
check('revenge win rate', byKey.get('revenge')!.winRate, 25);
check('revenge expectancy', byKey.get('revenge')!.expectancy, -26.25);
// noStop: -60 and -100 = -160 over 2 trades — below the 3-trade floor.
check('a 2-trade habit is not reported as a pattern', byKey.has('noStop'), false);
// planned: 50 + 40 + 30 = 120 over 3, all winners.
check('planned trades', byKey.get('planned')!.trades, 3);
check('planned net', byKey.get('planned')!.netProfit, 120);
check('planned win rate', byKey.get('planned')!.winRate, 100);
check('the worst habit is listed first', slices[0].key, 'revenge');
check('and the best last', slices[slices.length - 1].netProfit, 120);
check('tone comes from the tag table', byKey.get('revenge')!.tone, 'risk');
check('and the label is Persian', byKey.get('revenge')!.fa, 'انتقامی');
check('every discipline tag has metadata',
    ['revenge', 'oversize', 'noStop'].every(k => !!TAG_META[k]), true);

// ── the mood table ──────────────────────────────────────────────────
section('what each mood costs');

const LABELS = {
    confident: 'با اعتماد', disciplined: 'منظم', anxious: 'مضطرب',
    fearful: 'ترسیده', greedy: 'طمع‌کار', bored: 'بی‌حوصله',
};
const moodRows = [
    { emotion: 'greedy', netProfit: -80 },
    { emotion: 'greedy', netProfit: -60 },
    { emotion: 'greedy', netProfit: 20 },
    { emotion: 'disciplined', netProfit: 40 },
    { emotion: 'disciplined', netProfit: 35 },
    { emotion: 'disciplined', netProfit: -10 },
    { emotion: 'disciplined', netProfit: 25 },
    { emotion: 'anxious', netProfit: -50 },
    { emotion: 'anxious', netProfit: -30 },
    { emotion: null, netProfit: 500 },
];
const moods = sliceByEmotion(moodRows, LABELS);
const mood = (k: string) => moods.find(m => m.key === k);

// greedy: -80 -60 +20 = -120 over 3, 1 winner.
check('greedy trades counted', mood('greedy')!.trades, 3);
check('greedy bill', mood('greedy')!.netProfit, -120);
check('greedy win rate', mood('greedy')!.winRate, 33.3);
check('greedy expectancy', mood('greedy')!.expectancy, -40);
// disciplined: 40 + 35 - 10 + 25 = 90 over 4, 3 winners.
check('disciplined net', mood('disciplined')!.netProfit, 90);
check('disciplined win rate', mood('disciplined')!.winRate, 75);
// anxious has only 2 trades — under the floor.
check('a mood seen twice is not a pattern', !!mood('anxious'), false);
check('untagged trades are not a mood', !!mood('null'), false);
truthy('and the big untagged winner does not inflate any row',
    moods.every(m => m.netProfit !== 500));
check('the most expensive mood is first', moods[0].key, 'greedy');
check('the label comes from the table it was given', mood('greedy')!.label, 'طمع‌کار');
check('no notes, no moods', sliceByEmotion([], LABELS).length, 0);
check('all untagged, no moods',
    sliceByEmotion([{ emotion: null, netProfit: 10 }], LABELS).length, 0);

// ── report ──────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(64)}`);
if (failures.length) {
    console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
    failures.forEach(f => console.log(`  ✗ ${f}\n`));
    process.exit(1);
}
console.log(`✅ all ${passed} assertions passed`);
