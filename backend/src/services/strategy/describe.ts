/**
 * SPEC → PLAIN LANGUAGE (fa / en)
 *
 * Deterministic renderer: the sentences the user reads are derived from the
 * exact JSON the engine will run — never from the AI's own paraphrase, which
 * could drift from what was actually saved. Persian first (the product's
 * language), English kept for logs and mixed-language users.
 */

import {
    Condition, Filter, IndicatorDef, StrategySpec,
} from './types';

export type Lang = 'fa' | 'en';

const SOURCE_FA: Record<string, string> = {
    open: 'قیمت باز شدن', high: 'سقف کندل', low: 'کف کندل', close: 'قیمت پایانی',
    volume: 'حجم', hl2: 'میانگین سقف/کف', hlc3: 'میانگین سقف/کف/پایانی', ohlc4: 'میانگین چهار قیمت',
};
const SOURCE_EN: Record<string, string> = {
    open: 'the open', high: 'the high', low: 'the low', close: 'the close',
    volume: 'volume', hl2: 'HL2', hlc3: 'HLC3', ohlc4: 'OHLC4',
};

const SESSION_FA: Record<string, string> = {
    sydney: 'سیدنی', tokyo: 'توکیو', london: 'لندن', newyork: 'نیویورک',
};

const WEEKDAY_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const WEEKDAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "EMA(20)", "MACD(12,26,9) on 4h", … */
export function indicatorLabel(def: IndicatorDef): string {
    const tf = def.timeframe ? ` @${def.timeframe}` : '';
    switch (def.type) {
        case 'MACD': return `MACD(${def.fast ?? 12},${def.slow ?? 26},${def.signal ?? 9})${tf}`;
        case 'BBANDS': return `Bollinger(${def.period ?? 20},${def.mult ?? 2})${tf}`;
        case 'STOCH': return `Stochastic(${def.kPeriod ?? 14},${def.dPeriod ?? 3})${tf}`;
        default: {
            const src = def.source && def.source !== 'close' ? `,${def.source}` : '';
            return `${def.type}(${def.period ?? ''}${src})${tf}`;
        }
    }
}

function operandLabel(op: number | string, spec: StrategySpec, lang: Lang): string {
    if (typeof op === 'number') return String(op);
    const [name, field] = op.split('.');
    const def = spec.indicators?.[name];
    if (def) {
        const base = indicatorLabel(def);
        return field ? `${base}.${field}` : base;
    }
    const table = lang === 'fa' ? SOURCE_FA : SOURCE_EN;
    return table[op] ?? op;
}

export function describeCondition(c: Condition, spec: StrategySpec, lang: Lang): string {
    const L = (op: number | string) => operandLabel(op, spec, lang);
    const fa = lang === 'fa';
    if ('gt' in c) return fa ? `${L(c.gt[0])} بالاتر از ${L(c.gt[1])} باشد` : `${L(c.gt[0])} is above ${L(c.gt[1])}`;
    if ('gte' in c) return fa ? `${L(c.gte[0])} بالاتر یا برابر ${L(c.gte[1])} باشد` : `${L(c.gte[0])} is at or above ${L(c.gte[1])}`;
    if ('lt' in c) return fa ? `${L(c.lt[0])} پایین‌تر از ${L(c.lt[1])} باشد` : `${L(c.lt[0])} is below ${L(c.lt[1])}`;
    if ('lte' in c) return fa ? `${L(c.lte[0])} پایین‌تر یا برابر ${L(c.lte[1])} باشد` : `${L(c.lte[0])} is at or below ${L(c.lte[1])}`;
    if ('crossesAbove' in c) return fa ? `${L(c.crossesAbove[0])} از ${L(c.crossesAbove[1])} رو به بالا عبور کند` : `${L(c.crossesAbove[0])} crosses above ${L(c.crossesAbove[1])}`;
    if ('crossesBelow' in c) return fa ? `${L(c.crossesBelow[0])} از ${L(c.crossesBelow[1])} رو به پایین عبور کند` : `${L(c.crossesBelow[0])} crosses below ${L(c.crossesBelow[1])}`;
    if ('rising' in c) return fa ? `${L(c.rising[0])} نسبت به ${c.rising[1]} کندل قبل بالاتر باشد` : `${L(c.rising[0])} is higher than ${c.rising[1]} bars ago`;
    if ('falling' in c) return fa ? `${L(c.falling[0])} نسبت به ${c.falling[1]} کندل قبل پایین‌تر باشد` : `${L(c.falling[0])} is lower than ${c.falling[1]} bars ago`;
    if ('all' in c) return c.all.map(x => describeCondition(x, spec, lang)).join(fa ? ' و ' : ' AND ');
    if ('any' in c) return '(' + c.any.map(x => describeCondition(x, spec, lang)).join(fa ? ' یا ' : ' OR ') + ')';
    if ('not' in c) return (fa ? 'برقرار نباشد که ' : 'NOT ') + describeCondition(c.not, spec, lang);
    return fa ? 'شرط ناشناخته' : 'unknown condition';
}

function describeFilter(f: Filter, lang: Lang): string {
    const fa = lang === 'fa';
    if ('session' in f) return fa ? `فقط در سشن ${SESSION_FA[f.session] ?? f.session}` : `only during the ${f.session} session`;
    if ('hoursUtc' in f) return fa ? `فقط بین ساعت ${f.hoursUtc[0]} تا ${f.hoursUtc[1]} UTC` : `only between ${f.hoursUtc[0]}:00 and ${f.hoursUtc[1]}:00 UTC`;
    if ('weekdaysUtc' in f) {
        const names = f.weekdaysUtc.map(d => (fa ? WEEKDAY_FA : WEEKDAY_EN)[d] ?? d).join(fa ? '، ' : ', ');
        return fa ? `فقط روزهای ${names}` : `only on ${names}`;
    }
    if ('maxSpreadPips' in f) return fa ? `ورود فقط وقتی اسپرد حداکثر ${f.maxSpreadPips} پیپ باشد` : `enter only when the spread is at most ${f.maxSpreadPips} pips`;
    return fa ? 'فیلتر ناشناخته' : 'unknown filter';
}

/**
 * The full rule sheet, one sentence per line. Everything the engine will
 * actually do — and nothing it won't.
 */
export function describeSpec(spec: StrategySpec, lang: Lang = 'fa'): string[] {
    const fa = lang === 'fa';
    const lines: string[] = [];

    lines.push(fa
        ? `نماد ${spec.symbol}، تایم‌فریم ${spec.timeframe} — تصمیم‌گیری فقط روی کندل بسته‌شده.`
        : `${spec.symbol} on the ${spec.timeframe} timeframe — decisions only on closed bars.`);

    if (spec.entry.long) {
        lines.push((fa ? 'ورود خرید وقتی: ' : 'Go LONG when: ') + describeCondition(spec.entry.long, spec, lang) + (fa ? '.' : '.'));
    }
    if (spec.entry.short) {
        lines.push((fa ? 'ورود فروش وقتی: ' : 'Go SHORT when: ') + describeCondition(spec.entry.short, spec, lang) + (fa ? '.' : '.'));
    }

    const sl = spec.exit.stopLoss;
    lines.push(fa
        ? `حد ضرر: ${'pips' in sl ? `${sl.pips} پیپ` : `${sl.atrMultiple} برابر ATR(14)`} از قیمت ورود.`
        : `Stop loss: ${'pips' in sl ? `${sl.pips} pips` : `${sl.atrMultiple}x ATR(14)`} from entry.`);

    const tp = spec.exit.takeProfit;
    if (tp) {
        const txt = 'pips' in tp ? (fa ? `${tp.pips} پیپ` : `${tp.pips} pips`)
            : 'atrMultiple' in tp ? (fa ? `${tp.atrMultiple} برابر ATR(14)` : `${tp.atrMultiple}x ATR(14)`)
            : (fa ? `${tp.rMultiple} برابر ریسک (R)` : `${tp.rMultiple}R`);
        lines.push(fa ? `حد سود: ${txt}.` : `Take profit: ${txt}.`);
    }
    if (spec.exit.trailingStop) {
        const t = spec.exit.trailingStop;
        lines.push(fa
            ? `حد ضرر متحرک: ${'pips' in t ? `${t.pips} پیپ` : `${t.atrMultiple} برابر ATR(14)`}.`
            : `Trailing stop: ${'pips' in t ? `${t.pips} pips` : `${t.atrMultiple}x ATR(14)`}.`);
    }
    if (spec.exit.timeStop) {
        lines.push(fa
            ? `خروج زمانی: بعد از ${spec.exit.timeStop.bars} کندل، هرجا بود می‌بندد.`
            : `Time stop: closes after ${spec.exit.timeStop.bars} bars, wherever price is.`);
    }
    if (spec.exit.signal?.long) {
        lines.push((fa ? 'بستن خرید وقتی: ' : 'Close a LONG when: ') + describeCondition(spec.exit.signal.long, spec, lang) + '.');
    }
    if (spec.exit.signal?.short) {
        lines.push((fa ? 'بستن فروش وقتی: ' : 'Close a SHORT when: ') + describeCondition(spec.exit.signal.short, spec, lang) + '.');
    }

    lines.push('riskPercent' in spec.sizing
        ? (fa ? `حجم: ${spec.sizing.riskPercent}٪ ریسک از موجودی در هر معامله (بر اساس فاصله‌ی حد ضرر).`
            : `Position size: risk ${spec.sizing.riskPercent}% of equity per trade (from the stop distance).`)
        : (fa ? `حجم: ثابت ${spec.sizing.fixedLots} لات.` : `Position size: fixed ${spec.sizing.fixedLots} lots.`));

    for (const f of spec.filters ?? []) lines.push(describeFilter(f, lang) + (fa ? '.' : '.'));

    if (spec.limits?.maxTradesPerDay) {
        lines.push(fa ? `حداکثر ${spec.limits.maxTradesPerDay} معامله در روz.`.replace('روz', 'روز') : `At most ${spec.limits.maxTradesPerDay} trades per day.`);
    }
    if (spec.limits?.cooldownBars) {
        lines.push(fa ? `بعد از هر خروج ${spec.limits.cooldownBars} کندل صبر می‌کند.` : `Waits ${spec.limits.cooldownBars} bars after an exit before re-entering.`);
    }

    lines.push(fa ? 'در هر لحظه حداکثر یک پوزیشن باز.' : 'At most one open position at a time.');
    return lines;
}
