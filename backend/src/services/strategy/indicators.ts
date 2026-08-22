/**
 * INCREMENTAL INDICATORS
 *
 * Every indicator here updates in O(1) or O(period) per bar with a fixed,
 * small memory footprint — no full-series recompute, no per-bar allocation.
 * That is what lets one process serve a thousand bots: the indicator bus
 * computes each (symbol, timeframe, definition) once per bar and every bot
 * that references it reads the same accumulator.
 *
 * Conventions (documented so backtest and live can never disagree):
 *  - EMA seeds with the SMA of its first `period` values, then k = 2/(n+1).
 *  - RSI and ATR use Wilder smoothing, seeded with a simple average.
 *  - Bollinger uses the population standard deviation.
 *  - The first ATR true range is high − low (no previous close yet).
 *  - Values are NaN until the indicator has seen enough bars (`ready()`);
 *    conditions over NaN evaluate to false, so warm-up bars can never trade.
 */

import { Bar, IndicatorDef, Source } from './types';

export function sourceValue(bar: Bar, source: Source = 'close'): number {
    switch (source) {
        case 'open': return bar.open;
        case 'high': return bar.high;
        case 'low': return bar.low;
        case 'close': return bar.close;
        case 'volume': return bar.volume;
        case 'hl2': return (bar.high + bar.low) / 2;
        case 'hlc3': return (bar.high + bar.low + bar.close) / 3;
        case 'ohlc4': return (bar.open + bar.high + bar.low + bar.close) / 4;
    }
}

/** Fixed-capacity ring over a Float64Array. get(0) is the latest pushed. */
export class Ring {
    private buf: Float64Array;
    private head = 0;
    private count = 0;

    constructor(capacity: number) {
        this.buf = new Float64Array(capacity);
    }

    push(v: number): void {
        this.buf[this.head] = v;
        this.head = (this.head + 1) % this.buf.length;
        if (this.count < this.buf.length) this.count++;
    }

    /** i bars back from the latest (0 = latest). NaN when out of range. */
    get(i: number): number {
        if (i < 0 || i >= this.count) return NaN;
        const idx = (this.head - 1 - i + 2 * this.buf.length) % this.buf.length;
        return this.buf[idx];
    }

    get length(): number { return this.count; }
    get capacity(): number { return this.buf.length; }
}

/** The contract every indicator implements. */
export interface Incr {
    /** Feed one CLOSED bar, in time order. */
    update(bar: Bar): void;
    ready(): boolean;
    /** Current value (of `field` for multi-output types). NaN until ready. */
    value(field?: string): number;
    /** Value as of the previous bar. NaN until two ready values exist. */
    prev(field?: string): number;
}

/** Tracks current/previous for one output stream. */
class Track {
    cur = NaN;
    last = NaN;
    set(v: number): void {
        this.last = this.cur;
        this.cur = v;
    }
}

// ═══════════════════════════════════════════════════════════════════

class SMA implements Incr {
    private ring: Ring;
    private sum = 0;
    private out = new Track();

    constructor(private period: number, private source: Source = 'close') {
        this.ring = new Ring(period);
    }

    update(bar: Bar): void {
        const x = sourceValue(bar, this.source);
        if (this.ring.length === this.ring.capacity) this.sum -= this.ring.get(this.period - 1);
        this.ring.push(x);
        this.sum += x;
        this.out.set(this.ring.length === this.period ? this.sum / this.period : NaN);
    }

    ready(): boolean { return !Number.isNaN(this.out.cur); }
    value(): number { return this.out.cur; }
    prev(): number { return this.out.last; }
}

/** Standalone EMA stream, reusable by MACD. */
class EmaStream {
    private k: number;
    private seedSum = 0;
    private seen = 0;
    cur = NaN;
    last = NaN;

    constructor(private period: number) {
        this.k = 2 / (period + 1);
    }

    push(x: number): void {
        this.last = this.cur;
        this.seen++;
        if (this.seen < this.period) {
            this.seedSum += x;
            this.cur = NaN;
        } else if (this.seen === this.period) {
            this.seedSum += x;
            this.cur = this.seedSum / this.period;
        } else {
            this.cur = this.cur + this.k * (x - this.cur);
        }
    }
}

class EMA implements Incr {
    private stream: EmaStream;

    constructor(period: number, private source: Source = 'close') {
        this.stream = new EmaStream(period);
    }

    update(bar: Bar): void { this.stream.push(sourceValue(bar, this.source)); }
    ready(): boolean { return !Number.isNaN(this.stream.cur); }
    value(): number { return this.stream.cur; }
    prev(): number { return this.stream.last; }
}

class RSI implements Incr {
    private prevX = NaN;
    private changes = 0;
    private gainSum = 0;
    private lossSum = 0;
    private avgGain = NaN;
    private avgLoss = NaN;
    private out = new Track();

    constructor(private period: number, private source: Source = 'close') {}

    update(bar: Bar): void {
        const x = sourceValue(bar, this.source);
        if (Number.isNaN(this.prevX)) {
            this.prevX = x;
            this.out.set(NaN);
            return;
        }
        const change = x - this.prevX;
        this.prevX = x;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;

        this.changes++;
        if (this.changes < this.period) {
            this.gainSum += gain;
            this.lossSum += loss;
            this.out.set(NaN);
            return;
        }
        if (this.changes === this.period) {
            this.avgGain = (this.gainSum + gain) / this.period;
            this.avgLoss = (this.lossSum + loss) / this.period;
        } else {
            this.avgGain = (this.avgGain * (this.period - 1) + gain) / this.period;
            this.avgLoss = (this.avgLoss * (this.period - 1) + loss) / this.period;
        }
        const v = this.avgLoss === 0
            ? (this.avgGain === 0 ? 50 : 100)
            : 100 - 100 / (1 + this.avgGain / this.avgLoss);
        this.out.set(v);
    }

    ready(): boolean { return !Number.isNaN(this.out.cur); }
    value(): number { return this.out.cur; }
    prev(): number { return this.out.last; }
}

class ATR implements Incr {
    private prevClose = NaN;
    private seen = 0;
    private trSum = 0;
    private atr = NaN;
    private out = new Track();

    constructor(private period: number) {}

    update(bar: Bar): void {
        const tr = Number.isNaN(this.prevClose)
            ? bar.high - bar.low
            : Math.max(
                bar.high - bar.low,
                Math.abs(bar.high - this.prevClose),
                Math.abs(bar.low - this.prevClose),
            );
        this.prevClose = bar.close;
        this.seen++;

        if (this.seen < this.period) {
            this.trSum += tr;
            this.out.set(NaN);
            return;
        }
        if (this.seen === this.period) {
            this.atr = (this.trSum + tr) / this.period;
        } else {
            this.atr = (this.atr * (this.period - 1) + tr) / this.period;
        }
        this.out.set(this.atr);
    }

    ready(): boolean { return !Number.isNaN(this.out.cur); }
    value(): number { return this.out.cur; }
    prev(): number { return this.out.last; }
}

class MACD implements Incr {
    private fastS: EmaStream;
    private slowS: EmaStream;
    private signalS: EmaStream;
    private macd = new Track();
    private signal = new Track();
    private hist = new Track();

    constructor(fast: number, slow: number, signalPeriod: number, private source: Source = 'close') {
        this.fastS = new EmaStream(fast);
        this.slowS = new EmaStream(slow);
        this.signalS = new EmaStream(signalPeriod);
    }

    update(bar: Bar): void {
        const x = sourceValue(bar, this.source);
        this.fastS.push(x);
        this.slowS.push(x);

        if (Number.isNaN(this.fastS.cur) || Number.isNaN(this.slowS.cur)) {
            this.macd.set(NaN);
            this.signal.set(NaN);
            this.hist.set(NaN);
            return;
        }
        const m = this.fastS.cur - this.slowS.cur;
        this.macd.set(m);
        this.signalS.push(m);
        this.signal.set(this.signalS.cur);
        this.hist.set(Number.isNaN(this.signalS.cur) ? NaN : m - this.signalS.cur);
    }

    ready(): boolean { return !Number.isNaN(this.hist.cur); }

    value(field = 'macd'): number {
        return field === 'signal' ? this.signal.cur : field === 'hist' ? this.hist.cur : this.macd.cur;
    }
    prev(field = 'macd'): number {
        return field === 'signal' ? this.signal.last : field === 'hist' ? this.hist.last : this.macd.last;
    }
}

class BBANDS implements Incr {
    private ring: Ring;
    private sum = 0;
    private sumSq = 0;
    private upper = new Track();
    private middle = new Track();
    private lower = new Track();

    constructor(private period: number, private mult: number, private source: Source = 'close') {
        this.ring = new Ring(period);
    }

    update(bar: Bar): void {
        const x = sourceValue(bar, this.source);
        if (this.ring.length === this.ring.capacity) {
            const old = this.ring.get(this.period - 1);
            this.sum -= old;
            this.sumSq -= old * old;
        }
        this.ring.push(x);
        this.sum += x;
        this.sumSq += x * x;

        if (this.ring.length < this.period) {
            this.upper.set(NaN); this.middle.set(NaN); this.lower.set(NaN);
            return;
        }
        const mean = this.sum / this.period;
        const variance = Math.max(0, this.sumSq / this.period - mean * mean);
        const sd = Math.sqrt(variance);
        this.middle.set(mean);
        this.upper.set(mean + this.mult * sd);
        this.lower.set(mean - this.mult * sd);
    }

    ready(): boolean { return !Number.isNaN(this.middle.cur); }

    value(field = 'middle'): number {
        return field === 'upper' ? this.upper.cur : field === 'lower' ? this.lower.cur : this.middle.cur;
    }
    prev(field = 'middle'): number {
        return field === 'upper' ? this.upper.last : field === 'lower' ? this.lower.last : this.middle.last;
    }
}

class STOCH implements Incr {
    private highs: Ring;
    private lows: Ring;
    private kRing: Ring;
    private kSum = 0;
    private k = new Track();
    private d = new Track();

    constructor(private kPeriod: number, private dPeriod: number) {
        this.highs = new Ring(kPeriod);
        this.lows = new Ring(kPeriod);
        this.kRing = new Ring(dPeriod);
    }

    update(bar: Bar): void {
        this.highs.push(bar.high);
        this.lows.push(bar.low);

        if (this.highs.length < this.kPeriod) {
            this.k.set(NaN); this.d.set(NaN);
            return;
        }
        let hh = -Infinity;
        let ll = Infinity;
        for (let i = 0; i < this.kPeriod; i++) {
            const h = this.highs.get(i);
            const l = this.lows.get(i);
            if (h > hh) hh = h;
            if (l < ll) ll = l;
        }
        const kv = hh === ll ? 50 : ((bar.close - ll) / (hh - ll)) * 100;
        this.k.set(kv);

        if (this.kRing.length === this.kRing.capacity) this.kSum -= this.kRing.get(this.dPeriod - 1);
        this.kRing.push(kv);
        this.kSum += kv;
        this.d.set(this.kRing.length === this.dPeriod ? this.kSum / this.dPeriod : NaN);
    }

    ready(): boolean { return !Number.isNaN(this.k.cur); }

    value(field = 'k'): number { return field === 'd' ? this.d.cur : this.k.cur; }
    prev(field = 'k'): number { return field === 'd' ? this.d.last : this.k.last; }
}

class Extreme implements Incr {
    private ring: Ring;
    private out = new Track();

    constructor(private period: number, private highest: boolean, private source: Source) {
        this.ring = new Ring(period);
    }

    update(bar: Bar): void {
        this.ring.push(sourceValue(bar, this.source));
        if (this.ring.length < this.period) {
            this.out.set(NaN);
            return;
        }
        let best = this.highest ? -Infinity : Infinity;
        for (let i = 0; i < this.period; i++) {
            const v = this.ring.get(i);
            if (this.highest ? v > best : v < best) best = v;
        }
        this.out.set(best);
    }

    ready(): boolean { return !Number.isNaN(this.out.cur); }
    value(): number { return this.out.cur; }
    prev(): number { return this.out.last; }
}

// ═══════════════════════════════════════════════════════════════════

export function createIndicator(def: IndicatorDef): Incr {
    switch (def.type) {
        case 'SMA': return new SMA(def.period!, def.source);
        case 'EMA': return new EMA(def.period!, def.source);
        case 'RSI': return new RSI(def.period!, def.source);
        case 'ATR': return new ATR(def.period!);
        case 'MACD': return new MACD(def.fast!, def.slow!, def.signal!, def.source);
        case 'BBANDS': return new BBANDS(def.period!, def.mult!, def.source);
        case 'STOCH': return new STOCH(def.kPeriod!, def.dPeriod!);
        case 'HIGHEST': return new Extreme(def.period!, true, def.source ?? 'high');
        case 'LOWEST': return new Extreme(def.period!, false, def.source ?? 'low');
    }
}

/**
 * Canonical key for the shared indicator bus: two definitions that would
 * always produce the same stream get the same key.
 */
export function indicatorKey(symbol: string, tf: string, def: IndicatorDef): string {
    const parts: (string | number)[] = [symbol, tf, def.type];
    for (const k of ['period', 'source', 'fast', 'slow', 'signal', 'mult', 'kPeriod', 'dPeriod'] as const) {
        if (def[k] !== undefined) parts.push(`${k}=${def[k]}`);
    }
    return parts.join('|');
}
