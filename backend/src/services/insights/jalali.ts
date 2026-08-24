/**
 * JALALI CALENDAR — a Persian trader's journal should be dated in the
 * calendar they actually live in. «۲ شهریور ۱۴۰۵» is a date; «August 24,
 * 2026» is a translation of one.
 *
 * This is the Borkowski/jalaali algorithm: integer arithmetic over the
 * Julian Day Number, with the 33-year leap-cycle breaks table. No
 * dependency, no locale data, no drift — the same input always gives the
 * same output, which is the only property a journal date needs.
 */

const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.floor(a / b) * b;

/** Breaks in the 33-year leap cycle. Valid for Jalali years -61..3177. */
const BREAKS = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181,
    1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
];

export const MONTHS_FA = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

/** Saturday-first, the way a Persian week is read. */
export const WEEKDAYS_FA = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
export const WEEKDAYS_FA_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export interface JalaliDate { jy: number; jm: number; jd: number }

/** Gregorian → Julian Day Number. */
export function g2d(gy: number, gm: number, gd: number): number {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
        + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    d = d - div(div(gy + div(gm - 8, 6) + 100100, 100) * 3, 4) + 752;
    return d;
}

/** Julian Day Number → Gregorian. */
export function d2g(jdn: number): { gy: number; gm: number; gd: number } {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
}

/**
 * For a Jalali year: its leap offset, the Gregorian year it starts in,
 * and the March day Farvardin 1 falls on.
 */
function jalCal(jy: number): { leap: number; gy: number; march: number } {
    const bl = BREAKS.length;
    const gy = jy + 621;
    let leapJ = -14;
    let jp = BREAKS[0];
    if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error(`Jalali year out of range: ${jy}`);

    let jump = 0;
    for (let i = 1; i < bl; i++) {
        const jm = BREAKS[i];
        jump = jm - jp;
        if (jy < jm) break;
        leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
        jp = jm;
    }
    let n = jy - jp;

    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;

    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;

    return { leap, gy, march };
}

/** Is this Jalali year a leap year (Esfand has 30 days)? */
export function isJalaliLeap(jy: number): boolean {
    return jalCal(jy).leap === 0;
}

/** Days in a Jalali month: 31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29/30. */
export function jalaliMonthLength(jy: number, jm: number): number {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isJalaliLeap(jy) ? 30 : 29;
}

/** Jalali → Julian Day Number. */
export function j2d(jy: number, jm: number, jd: number): number {
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

/** Julian Day Number → Jalali. */
export function d2j(jdn: number): JalaliDate {
    const gy = d2g(jdn).gy;
    let jy = gy - 621;
    const r = jalCal(jy);
    const jdn1f = g2d(gy, 3, r.march);
    let k = jdn - jdn1f;

    if (k >= 0) {
        if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
        k -= 186;
    } else {
        // Before Farvardin 1: this date is in the tail of the previous
        // Jalali year. `r.leap === 1` says that previous year was a leap
        // year, so its Esfand ran to 30 days. It has to be read from `r`
        // — this year's position in the cycle — not from a fresh jalCal
        // of the decremented year, which asks about the year before that.
        jy -= 1;
        k += 179;
        if (r.leap === 1) k += 1;
    }
    return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

/** '2026-08-24' → { jy: 1405, jm: 6, jd: 2 } */
export function toJalali(isoDay: string): JalaliDate {
    const [y, m, d] = isoDay.split('-').map(Number);
    return d2j(g2d(y, m, d));
}

/** { 1405, 6, 2 } → '2026-08-24' */
export function toGregorianDay(jy: number, jm: number, jd: number): string {
    const g = d2g(j2d(jy, jm, jd));
    return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
/** Latin digits → Persian digits, for text a Persian reader reads. */
export function faDigits(s: string | number): string {
    return String(s).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** '2026-08-24' → '۲ شهریور ۱۴۰۵' */
export function formatJalali(isoDay: string, withYear = true): string {
    const { jy, jm, jd } = toJalali(isoDay);
    return `${faDigits(jd)} ${MONTHS_FA[jm - 1]}${withYear ? ` ${faDigits(jy)}` : ''}`;
}

/**
 * Weekday index with Saturday = 0, the Persian week's first day.
 * (JS getUTCDay has Sunday = 0.)
 */
export function jalaliWeekday(isoDay: string): number {
    const [y, m, d] = isoDay.split('-').map(Number);
    return (Date.UTC(y, m - 1, d) / 86_400_000 + 4 + 1) % 7;
}
