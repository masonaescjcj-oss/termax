/**
 * AUTO-WRITTEN JOURNAL ENTRY — the sentence a trader would have written
 * if they had kept a journal, composed from what actually happened.
 *
 * Two rules hold everywhere in this file:
 *
 *  1. Every clause is gated on evidence. If the candles that would prove
 *     a clause are missing, the clause is left out — the entry gets
 *     shorter, never vaguer. It will never say "in a strong uptrend"
 *     because that reads well.
 *  2. No model writes any of it. The words are templates; the numbers
 *     come from the engine. That makes the journal free to produce, the
 *     same every time it is opened, and impossible to hallucinate into.
 *
 * Tags are the other half. They are *measured* habits, not moods: a
 * trade is tagged «انتقامی» because it opened 11 minutes after a loss,
 * and the tag carries that number with it.
 */

import { getSpec } from '../../config/instruments';
import { JournalTags } from './journal';

export type TagTone = 'risk' | 'good' | 'neutral';

export interface TagMeta {
    key: string;
    fa: string;
    en: string;
    tone: TagTone;
    /** Explains, in Persian, what earned the tag — shown on long-press. */
    whyFa: string;
}

/**
 * The three discipline tags. A day counts as "clean" only if none of its
 * trades carries one, because these three are process failures the
 * trader fully controls — unlike a losing trade, which can be a correct
 * decision with a bad outcome. Streaks reward process, never profit.
 */
export const DISCIPLINE_TAGS = ['revenge', 'oversize', 'noStop'] as const;

export const TAG_META: Record<string, TagMeta> = {
    revenge: { key: 'revenge', fa: 'انتقامی', en: 'revenge', tone: 'risk',
        whyFa: 'کمتر از ۳۰ دقیقه بعد از یک معامله‌ی ضررده باز شد' },
    oversize: { key: 'oversize', fa: 'حجم بزرگ', en: 'oversized', tone: 'risk',
        whyFa: 'حجمش دست‌کم ۱.۵ برابر حجم معمولِ خودتان بود' },
    noStop: { key: 'noStop', fa: 'بدون حد ضرر', en: 'no stop', tone: 'risk',
        whyFa: 'بدون حد ضرر باز شد' },
    tightStop: { key: 'tightStop', fa: 'حد ضرر تنگ', en: 'tight stop', tone: 'risk',
        whyFa: 'فاصله‌ی حد ضرر کمتر از نصف نوسان معمول بازار بود — داخل نویز' },
    counterTrend: { key: 'counterTrend', fa: 'خلاف روند', en: 'counter-trend', tone: 'neutral',
        whyFa: 'جهت معامله مخالف روند لحظه‌ی ورود بود' },
    wildVol: { key: 'wildVol', fa: 'نوسان بالا', en: 'high volatility', tone: 'neutral',
        whyFa: 'نوسان بازار دست‌کم ۱.۵ برابر حالت معمول خودش بود' },
    quietVol: { key: 'quietVol', fa: 'بازار آرام', en: 'quiet market', tone: 'neutral',
        whyFa: 'نوسان بازار کمتر از ۰.۷ برابر حالت معمول خودش بود' },
    offHours: { key: 'offHours', fa: 'خارج از سشن', en: 'off hours', tone: 'neutral',
        whyFa: 'ورود بیرون از سشن‌های اصلی بود' },
    withTrend: { key: 'withTrend', fa: 'هم‌جهت با روند', en: 'with the trend', tone: 'good',
        whyFa: 'جهت معامله با روند لحظه‌ی ورود هم‌خوان بود' },
    planned: { key: 'planned', fa: 'با حد ضرر و هدف', en: 'planned', tone: 'good',
        whyFa: 'از ابتدا هم حد ضرر داشت هم حد سود' },
    stopHunted: { key: 'stopHunted', fa: 'حد ضرر خورد و برگشت', en: 'stopped then reversed', tone: 'neutral',
        whyFa: 'بعد از خوردن حد ضرر، قیمت دست‌کم ۱R به نفع معامله برگشت' },
    gaveBack: { key: 'gaveBack', fa: 'سود را برگرداند', en: 'gave back profit', tone: 'risk',
        whyFa: 'در اوج، دست‌کم دو برابر سود نهایی روی میز بود' },
};

export interface JournalTradeInput {
    symbol: string;
    side: 'BUY' | 'SELL';
    volume: number;
    entryPrice: number;
    closePrice: number;
    openTime: number;
    closeTime: number;
    netProfit: number;
    stopLoss?: number | null;
    takeProfit?: number | null;
}

export interface TagOptions {
    /** Close time of the trade closed immediately before this one opened. */
    prevCloseTime?: number | null;
    prevWasLoss?: boolean;
    /** The trader's own median volume, so "big" means big *for them*. */
    medianVolume?: number | null;
}

const REVENGE_WINDOW_MS = 30 * 60_000;
const OVERSIZE_RATIO = 1.5;
const TIGHT_STOP_ATR = 0.5;

/** Signed result in pips, positive when the trade made money on price. */
export function resultPips(t: JournalTradeInput): number {
    const spec = getSpec(t.symbol);
    const raw = t.side === 'BUY' ? t.closePrice - t.entryPrice : t.entryPrice - t.closePrice;
    return Number((raw / spec.pipSize).toFixed(1));
}

/** Distance to the stop in pips, or null when there was no stop. */
export function stopPipsOf(t: JournalTradeInput): number | null {
    if (t.stopLoss == null || !Number.isFinite(t.stopLoss)) return null;
    const spec = getSpec(t.symbol);
    return Number((Math.abs(t.entryPrice - t.stopLoss) / spec.pipSize).toFixed(1));
}

/**
 * The tags that need nothing but the trade and its context — cheap
 * enough to run over a whole month. The two that need a full autopsy
 * (stopHunted, gaveBack) are added by the day view, which runs one.
 */
export function autoTags(t: JournalTradeInput, ctx: JournalTags | null, opts: TagOptions = {}): string[] {
    const tags: string[] = [];
    const hasContext = !!ctx && ctx.evidence.bars >= 60;

    if (opts.prevWasLoss && opts.prevCloseTime != null
        && t.openTime - opts.prevCloseTime <= REVENGE_WINDOW_MS
        && t.openTime >= opts.prevCloseTime) {
        tags.push('revenge');
    }
    if (opts.medianVolume && opts.medianVolume > 0) {
        // Compare the rounded ratio, not volume against median*1.5:
        // 0.1 * 1.5 is 0.15000000000000002 in binary floating point, so a
        // real 0.15 lot on a 0.10 median would slip past the tag.
        const ratio = Number((t.volume / opts.medianVolume).toFixed(4));
        if (ratio >= OVERSIZE_RATIO) tags.push('oversize');
    }

    const stopPips = stopPipsOf(t);
    if (stopPips === null) tags.push('noStop');
    else if (hasContext && ctx!.evidence.atrPips && stopPips < ctx!.evidence.atrPips * TIGHT_STOP_ATR) {
        tags.push('tightStop');
    }

    if (hasContext) {
        if (ctx!.withTrend === false) tags.push('counterTrend');
        if (ctx!.withTrend === true) tags.push('withTrend');
        if (ctx!.volatility === 'WILD') tags.push('wildVol');
        if (ctx!.volatility === 'QUIET') tags.push('quietVol');
        if (ctx!.session === 'offHours') tags.push('offHours');
    }

    if (stopPips !== null && t.takeProfit != null && Number.isFinite(t.takeProfit)) tags.push('planned');

    return tags;
}

/** Does this set of tags break the discipline streak? */
export function breaksDiscipline(tags: string[]): boolean {
    return tags.some(t => (DISCIPLINE_TAGS as readonly string[]).includes(t));
}

const SESSION_FA: Record<string, string> = {
    london: 'سشن لندن', newyork: 'سشن نیویورک', tokyo: 'سشن توکیو',
    sydney: 'سشن سیدنی', offHours: 'خارج از سشن‌های اصلی',
};
const SESSION_EN: Record<string, string> = {
    london: 'the London session', newyork: 'the New York session', tokyo: 'the Tokyo session',
    sydney: 'the Sydney session', offHours: 'outside the main sessions',
};
const TREND_FA = { UP: 'روند صعودی', DOWN: 'روند نزولی', RANGE: 'بازار رِنج' };
const TREND_EN = { UP: 'an uptrend', DOWN: 'a downtrend', RANGE: 'a range' };
const VOL_FA = { QUIET: 'نوسان کم', NORMAL: 'نوسان معمولی', WILD: 'نوسان بالا' };
const VOL_EN = { QUIET: 'low volatility', NORMAL: 'normal volatility', WILD: 'high volatility' };

function humanDuration(ms: number): { fa: string; en: string } {
    const mins = Math.max(1, Math.round(ms / 60_000));
    if (mins < 60) return { fa: `${mins} دقیقه`, en: `${mins} min` };
    const hours = mins / 60;
    if (mins < 1440) {
        const h = Number(hours.toFixed(hours < 10 ? 1 : 0));
        return { fa: `${h} ساعت`, en: `${h}h` };
    }
    const days = Number((mins / 1440).toFixed(mins < 14400 ? 1 : 0));
    return { fa: `${days} روز`, en: `${days}d` };
}

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;

export interface EntryExtras {
    /** The single most relevant autopsy verdict, already rendered. */
    verdictFa?: string | null;
    verdictEn?: string | null;
}

/**
 * The entry itself. Three clauses at most: what the setup was, how it
 * ended, and the one thing worth noticing. Longer journals get skipped;
 * this one is meant to be read.
 */
export function renderEntry(
    t: JournalTradeInput,
    ctx: JournalTags | null,
    extras: EntryExtras = {}
): { fa: string; en: string } {
    const dirFa = t.side === 'BUY' ? 'خرید' : 'فروش';
    const dirEn = t.side === 'BUY' ? 'Bought' : 'Sold';
    const hasContext = !!ctx && ctx.evidence.bars >= 60;

    // 1) the setup
    const faParts: string[] = [];
    const enParts: string[] = [];
    let setupFa = `${dirFa} ${t.volume} ${t.symbol}`;
    let setupEn = `${dirEn} ${t.volume} ${t.symbol}`;
    if (ctx) {
        setupFa += ` در ${SESSION_FA[ctx.session] ?? ctx.session}`;
        setupEn += ` in ${SESSION_EN[ctx.session] ?? ctx.session}`;
    }
    if (hasContext) {
        const trendFa = TREND_FA[ctx!.trend];
        const alignFa = ctx!.withTrend === null ? '' : ctx!.withTrend ? ' و هم‌جهت با آن' : ' و خلاف آن';
        setupFa += `، ${trendFa}${alignFa}، ${VOL_FA[ctx!.volatility]}`;
        const alignEn = ctx!.withTrend === null ? '' : ctx!.withTrend ? ', with it' : ', against it';
        setupEn += `, ${TREND_EN[ctx!.trend]}${alignEn}, ${VOL_EN[ctx!.volatility]}`;
    }
    faParts.push(setupFa + '.');
    enParts.push(setupEn + '.');

    // 2) how it ended
    const hold = humanDuration(t.closeTime - t.openTime);
    const pips = resultPips(t);
    const won = t.netProfit > 0;
    const pipWord = pips >= 0 ? `${pips} پیپ سود` : `${Math.abs(pips)} پیپ ضرر`;
    faParts.push(`${hold.fa} باز بود و با ${pipWord} (${money(t.netProfit)}) بسته شد.`);
    enParts.push(`Held ${hold.en}, closed ${pips >= 0 ? '+' : ''}${pips} pips (${money(t.netProfit)}).`);

    // 3) the one thing worth noticing — only when the engine found one
    if (extras.verdictFa) faParts.push(extras.verdictFa);
    if (extras.verdictEn) enParts.push(extras.verdictEn);

    // Say plainly when the regime could not be read, instead of guessing it.
    if (!hasContext) {
        faParts.push('کندل کافی برای تشخیص رژیم بازار در لحظه‌ی ورود نبود، پس برچسب بازار نخورد.');
        enParts.push('Not enough candle history at entry to read the regime, so it was left untagged.');
    }

    void won;
    return { fa: faParts.join(' '), en: enParts.join(' ') };
}

/** The day's own line: counted, then said. */
export function renderDayRecap(rows: Array<{ netProfit: number; symbol: string; side: string; tags: string[] }>):
    { fa: string; en: string } {
    if (!rows.length) return { fa: 'این روز معامله‌ای بسته نشد.', en: 'No trades closed on this day.' };

    const net = rows.reduce((s, r) => s + r.netProfit, 0);
    const wins = rows.filter(r => r.netProfit > 0).length;
    const best = rows.reduce((a, b) => (b.netProfit > a.netProfit ? b : a));
    const worst = rows.reduce((a, b) => (b.netProfit < a.netProfit ? b : a));

    const fa = [`${rows.length} معامله، ${wins} برد، جمعاً ${money(Number(net.toFixed(2)))}.`];
    const en = [`${rows.length} trades, ${wins} winners, ${money(Number(net.toFixed(2)))} total.`];
    if (rows.length > 1) {
        fa.push(`بهترین: ${best.side} ${best.symbol} با ${money(best.netProfit)}؛ بدترین: ${worst.side} ${worst.symbol} با ${money(worst.netProfit)}.`);
        en.push(`Best: ${best.side} ${best.symbol} ${money(best.netProfit)}; worst: ${worst.side} ${worst.symbol} ${money(worst.netProfit)}.`);
    }

    const broken = rows.filter(r => breaksDiscipline(r.tags));
    if (broken.length === 0) {
        fa.push('هیچ معامله‌ای بدون حد ضرر، انتقامی یا با حجم غیرعادی نبود — روز منظمی بود.');
        en.push('No trade was unstopped, revenge-driven or oversized — a disciplined day.');
    } else {
        const names = [...new Set(broken.flatMap(r => r.tags.filter(t => breaksDiscipline([t])).map(t => TAG_META[t].fa)))];
        // Leading with a Persian word, not a digit: in a right-to-left
        // sentence a clause that starts with "1" gets rendered flush
        // against the previous clause's "$100.05" and reads as one number.
        fa.push(`در ${broken.length} معامله برچسب ${names.join(' / ')} دیده شد.`);
        en.push(`${broken.length} trade(s) tagged ${[...new Set(broken.flatMap(r => r.tags.filter(t => breaksDiscipline([t])).map(t => TAG_META[t].en)))].join(' / ')}.`);
    }
    return { fa: fa.join(' '), en: en.join(' ') };
}
