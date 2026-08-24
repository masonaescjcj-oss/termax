/**
 * JOURNAL CALENDAR — the month grid, the streak, and the habit table.
 *
 * The calendar is the part of a journal people actually open. It answers
 * "how was my month?" before any number is read, so the only thing it
 * must get right is honesty of scale: a $2 day and a $200 day must not
 * look the same shade. Intensity is therefore relative to the month's
 * own largest absolute day, computed here rather than guessed by the
 * client.
 *
 * Days are bucketed in the *trader's* local day, not UTC. A trade closed
 * at 01:30 Tehran belongs to the night the trader remembers, and putting
 * it on the previous UTC date is the kind of small lie that makes people
 * stop trusting a journal.
 */

import {
    formatJalali, jalaliMonthLength, jalaliWeekday, MONTHS_FA,
    toGregorianDay, toJalali, faDigits, WEEKDAYS_FA_SHORT,
} from './jalali';
import { breaksDiscipline, TAG_META } from './journalEntry';

export interface JournalRow {
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    volume: number;
    netProfit: number;
    openTime: number;
    closeTime: number;
    tags: string[];
}

export interface DayCell {
    /** ISO calendar day in the trader's own timezone. */
    day: string;
    /** Day-of-month label in the active calendar, in Persian digits. */
    label: string;
    trades: number;
    wins: number;
    netProfit: number;
    /** No discipline tag on any trade that day. */
    clean: boolean;
    riskTags: string[];
    /** -1..1 — this day against the month's largest absolute day. */
    intensity: number;
}

/** 'YYYY-MM-DD' for a timestamp, shifted into the trader's own day. */
export function localDayKey(ts: number, tzOffsetMinutes = 0): string {
    return new Date(ts + tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

const round2 = (n: number) => Number(n.toFixed(2));

export interface MonthView {
    calendar: 'jalali' | 'gregorian';
    year: number;
    month: number;
    monthLabel: string;
    weekdayLabels: string[];
    /** Saturday = 0 for Jalali, Sunday = 0 for Gregorian. */
    firstWeekday: number;
    days: DayCell[];
    totals: {
        trades: number;
        wins: number;
        winRate: number;
        netProfit: number;
        tradingDays: number;
        greenDays: number;
        redDays: number;
        cleanDays: number;
        bestDay: { day: string; netProfit: number } | null;
        worstDay: { day: string; netProfit: number } | null;
    };
    prev: { year: number; month: number };
    next: { year: number; month: number };
}

/** The ISO days a Jalali or Gregorian month covers, in order. */
export function monthDayKeys(calendar: 'jalali' | 'gregorian', year: number, month: number): string[] {
    if (calendar === 'jalali') {
        const len = jalaliMonthLength(year, month);
        return Array.from({ length: len }, (_, i) => toGregorianDay(year, month, i + 1));
    }
    const len = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return Array.from({ length: len }, (_, i) =>
        `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
}

/**
 * Build the month. `rows` may cover any range — only the days of this
 * month are read, so the caller can hand over one query's worth of
 * trades without slicing them first.
 */
export function buildMonth(
    rows: JournalRow[],
    opts: { calendar?: 'jalali' | 'gregorian'; year: number; month: number; tzOffsetMinutes?: number }
): MonthView {
    const calendar = opts.calendar ?? 'jalali';
    const tz = opts.tzOffsetMinutes ?? 0;
    const keys = monthDayKeys(calendar, opts.year, opts.month);
    const inMonth = new Set(keys);

    const byDay = new Map<string, JournalRow[]>();
    for (const r of rows) {
        const key = localDayKey(r.closeTime, tz);
        if (!inMonth.has(key)) continue;
        const list = byDay.get(key) ?? [];
        list.push(r);
        byDay.set(key, list);
    }

    const raw = keys.map((day, i) => {
        const list = byDay.get(day) ?? [];
        const net = round2(list.reduce((s, r) => s + r.netProfit, 0));
        const riskTags = [...new Set(list.flatMap(r => r.tags.filter(t => breaksDiscipline([t]))))];
        return {
            day,
            label: faDigits(calendar === 'jalali' ? i + 1 : i + 1),
            trades: list.length,
            wins: list.filter(r => r.netProfit > 0).length,
            netProfit: net,
            clean: list.length > 0 && riskTags.length === 0,
            riskTags,
            intensity: 0,
        } as DayCell;
    });

    // Scale to the month's own biggest day, so a quiet month still shows
    // its shape instead of washing out to grey.
    const peak = Math.max(...raw.map(d => Math.abs(d.netProfit)), 0);
    for (const d of raw) d.intensity = peak > 0 ? Number((d.netProfit / peak).toFixed(3)) : 0;

    const traded = raw.filter(d => d.trades > 0);
    const trades = traded.reduce((s, d) => s + d.trades, 0);
    const wins = traded.reduce((s, d) => s + d.wins, 0);
    const best = traded.length ? traded.reduce((a, b) => (b.netProfit > a.netProfit ? b : a)) : null;
    const worst = traded.length ? traded.reduce((a, b) => (b.netProfit < a.netProfit ? b : a)) : null;

    const prev = calendar === 'jalali'
        ? (opts.month === 1 ? { year: opts.year - 1, month: 12 } : { year: opts.year, month: opts.month - 1 })
        : (opts.month === 1 ? { year: opts.year - 1, month: 12 } : { year: opts.year, month: opts.month - 1 });
    const next = opts.month === 12 ? { year: opts.year + 1, month: 1 } : { year: opts.year, month: opts.month + 1 };

    return {
        calendar,
        year: opts.year,
        month: opts.month,
        monthLabel: calendar === 'jalali'
            ? `${MONTHS_FA[opts.month - 1]} ${faDigits(opts.year)}`
            : `${opts.year}-${String(opts.month).padStart(2, '0')}`,
        weekdayLabels: calendar === 'jalali' ? WEEKDAYS_FA_SHORT : ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
        firstWeekday: calendar === 'jalali'
            ? jalaliWeekday(keys[0])
            : new Date(`${keys[0]}T00:00:00Z`).getUTCDay(),
        days: raw,
        totals: {
            trades,
            wins,
            winRate: trades ? Number(((wins / trades) * 100).toFixed(1)) : 0,
            netProfit: round2(traded.reduce((s, d) => s + d.netProfit, 0)),
            tradingDays: traded.length,
            greenDays: traded.filter(d => d.netProfit > 0).length,
            redDays: traded.filter(d => d.netProfit < 0).length,
            cleanDays: traded.filter(d => d.clean).length,
            bestDay: best ? { day: best.day, netProfit: best.netProfit } : null,
            worstDay: worst ? { day: worst.day, netProfit: worst.netProfit } : null,
        },
        prev, next,
    };
}

/**
 * The discipline streak: consecutive *trading* days with no discipline
 * tag, counting back from the latest day traded. Days with no trades
 * neither break nor extend it — not trading is not a discipline failure,
 * and it is not an achievement either.
 */
export function computeStreak(rows: JournalRow[], tzOffsetMinutes = 0): {
    current: number; best: number; lastDay: string | null; brokenBy: string[] | null;
} {
    const byDay = new Map<string, JournalRow[]>();
    for (const r of rows) {
        const key = localDayKey(r.closeTime, tzOffsetMinutes);
        const list = byDay.get(key) ?? [];
        list.push(r);
        byDay.set(key, list);
    }
    const days = [...byDay.keys()].sort();
    if (!days.length) return { current: 0, best: 0, lastDay: null, brokenBy: null };

    const cleanOf = (day: string) => !byDay.get(day)!.some(r => breaksDiscipline(r.tags));

    let best = 0, run = 0;
    for (const d of days) {
        run = cleanOf(d) ? run + 1 : 0;
        if (run > best) best = run;
    }

    let current = 0;
    let brokenBy: string[] | null = null;
    for (let i = days.length - 1; i >= 0; i--) {
        if (cleanOf(days[i])) current++;
        else {
            brokenBy = [...new Set(byDay.get(days[i])!.flatMap(r => r.tags.filter(t => breaksDiscipline([t]))))];
            break;
        }
    }
    return { current, best, lastDay: days[days.length - 1], brokenBy };
}

export interface TagSlice {
    key: string;
    fa: string;
    en: string;
    tone: string;
    trades: number;
    wins: number;
    winRate: number;
    netProfit: number;
    expectancy: number;
}

/**
 * What each habit actually costs. Sorted by net so the most expensive
 * habit is the first thing read — the point of the table is the bill,
 * not the taxonomy.
 */
export function sliceByTag(rows: JournalRow[], minTrades = 3): TagSlice[] {
    const map = new Map<string, { trades: number; wins: number; net: number }>();
    for (const r of rows) {
        for (const tag of new Set(r.tags)) {
            const cur = map.get(tag) ?? { trades: 0, wins: 0, net: 0 };
            cur.trades++;
            if (r.netProfit > 0) cur.wins++;
            cur.net += r.netProfit;
            map.set(tag, cur);
        }
    }
    return [...map.entries()]
        .filter(([, v]) => v.trades >= minTrades)
        .map(([key, v]) => ({
            key,
            fa: TAG_META[key]?.fa ?? key,
            en: TAG_META[key]?.en ?? key,
            tone: TAG_META[key]?.tone ?? 'neutral',
            trades: v.trades,
            wins: v.wins,
            winRate: Number(((v.wins / v.trades) * 100).toFixed(1)),
            netProfit: round2(v.net),
            expectancy: round2(v.net / v.trades),
        }))
        .sort((a, b) => a.netProfit - b.netProfit);
}

/**
 * What each mood costs.
 *
 * The mood is the one thing on a trade the engine cannot measure — the
 * trader chose it from a closed list, which is precisely why the list is
 * closed: a paragraph cannot be sliced, six labels can. Same floor as the
 * habit table, because a mood seen twice is a mood, not a pattern.
 */
export function sliceByEmotion(
    rows: Array<{ emotion: string | null; netProfit: number }>,
    labels: Record<string, string>,
    minTrades = 3
): Array<{ key: string; fa: string; trades: number; wins: number; winRate: number; netProfit: number; expectancy: number }> {
    const map = new Map<string, { trades: number; wins: number; net: number }>();
    for (const r of rows) {
        if (!r.emotion) continue;
        const cur = map.get(r.emotion) ?? { trades: 0, wins: 0, net: 0 };
        cur.trades++;
        if (r.netProfit > 0) cur.wins++;
        cur.net += r.netProfit;
        map.set(r.emotion, cur);
    }
    return [...map.entries()]
        .filter(([, v]) => v.trades >= minTrades)
        .map(([key, v]) => ({
            key,
            fa: labels[key] ?? key,
            trades: v.trades,
            wins: v.wins,
            winRate: Number(((v.wins / v.trades) * 100).toFixed(1)),
            netProfit: round2(v.net),
            expectancy: round2(v.net / v.trades),
        }))
        .sort((a, b) => a.netProfit - b.netProfit);
}

/** '2026-08-24' → '۲ شهریور ۱۴۰۵ (دوشنبه)' */
export function dayLabelFa(isoDay: string): string {
    const wd = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'][jalaliWeekday(isoDay)];
    return `${formatJalali(isoDay)} (${wd})`;
}

/** Which Jalali month a day belongs to — for "open the journal on today". */
export function jalaliMonthOf(isoDay: string): { year: number; month: number } {
    const { jy, jm } = toJalali(isoDay);
    return { year: jy, month: jm };
}
