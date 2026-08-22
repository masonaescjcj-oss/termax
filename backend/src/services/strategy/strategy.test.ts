/**
 * Strategy engine tests.
 *
 * The indicators are incremental for performance, and incremental updates are
 * exactly where subtle bugs live (a stale sum, an off-by-one ring index). So
 * every indicator is checked bar-by-bar against an independent NAIVE
 * implementation that recomputes from the full window each time — same
 * documented conventions, different code path. The interpreter is then pinned
 * on hand-constructed scenarios where the right answer is known in advance:
 * crossover timing, warm-up silence, session gates, daily limits, cooldowns,
 * time stops and determinism.
 *
 * Run with:  npx ts-node src/services/strategy/strategy.test.ts
 */

import { createIndicator, sourceValue } from './indicators';
import { BarAggregator, bucketStart } from './series';
import { compileStrategy } from './interpreter';
import { validateSpec } from './validate';
import { Bar, initialBotState, StrategySpec, TIMEFRAME_MS } from './types';

let passed = 0;
const failures: string[] = [];

function check(name: string, got: unknown, want: unknown, tol = 0) {
    const ok = typeof got === 'number' && typeof want === 'number'
        ? (Number.isNaN(got) && Number.isNaN(want)) || (Number.isFinite(got) && Math.abs(got - want) <= tol)
        : got === want;
    if (ok) passed++;
    else failures.push(`${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
}
const section = (t: string) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

// ── deterministic pseudo-random bars ───────────────────────────────
function lcg(seed: number) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0xffffffff;
    };
}

function randomBars(n: number, seed = 42, start = 1.10000): Bar[] {
    const rnd = lcg(seed);
    const bars: Bar[] = [];
    let close = start;
    let t = Date.UTC(2026, 0, 5); // Monday 00:00 UTC
    for (let i = 0; i < n; i++) {
        const open = close;
        close = open + (rnd() - 0.5) * 0.002;
        const wick = rnd() * 0.0008;
        bars.push({
            time: t,
            open,
            high: Math.max(open, close) + wick,
            low: Math.min(open, close) - wick,
            close,
            volume: 100 + Math.floor(rnd() * 900),
        });
        t += TIMEFRAME_MS['15m'];
    }
    return bars;
}

/** Bars from a list of closes (open = previous close), 1h apart by default. */
function barsFromCloses(closes: number[], startTime = Date.UTC(2026, 0, 5), tfMs = TIMEFRAME_MS['1h']): Bar[] {
    const bars: Bar[] = [];
    let prev = closes[0];
    for (let i = 0; i < closes.length; i++) {
        const c = closes[i];
        bars.push({
            time: startTime + i * tfMs,
            open: prev,
            high: Math.max(prev, c) + 0.0001,
            low: Math.min(prev, c) - 0.0001,
            close: c,
            volume: 100,
        });
        prev = c;
    }
    return bars;
}

// ── naive reference implementations (independent code path) ────────
const naive = {
    sma(xs: number[], i: number, p: number): number {
        if (i < p - 1) return NaN;
        let s = 0;
        for (let k = i - p + 1; k <= i; k++) s += xs[k];
        return s / p;
    },
    ema(xs: number[], i: number, p: number): number {
        if (i < p - 1) return NaN;
        let e = 0;
        for (let k = 0; k < p; k++) e += xs[k];
        e /= p;
        const kf = 2 / (p + 1);
        for (let k = p; k <= i; k++) e = e + kf * (xs[k] - e);
        return e;
    },
    rsi(xs: number[], i: number, p: number): number {
        if (i < p) return NaN;
        let g = 0, l = 0;
        for (let k = 1; k <= p; k++) {
            const d = xs[k] - xs[k - 1];
            if (d > 0) g += d; else l -= d;
        }
        let ag = g / p, al = l / p;
        for (let k = p + 1; k <= i; k++) {
            const d = xs[k] - xs[k - 1];
            ag = (ag * (p - 1) + Math.max(d, 0)) / p;
            al = (al * (p - 1) + Math.max(-d, 0)) / p;
        }
        if (al === 0) return ag === 0 ? 50 : 100;
        return 100 - 100 / (1 + ag / al);
    },
    atr(bars: Bar[], i: number, p: number): number {
        if (i < p - 1) return NaN;
        const tr = (k: number) => k === 0
            ? bars[0].high - bars[0].low
            : Math.max(
                bars[k].high - bars[k].low,
                Math.abs(bars[k].high - bars[k - 1].close),
                Math.abs(bars[k].low - bars[k - 1].close));
        let a = 0;
        for (let k = 0; k < p; k++) a += tr(k);
        a /= p;
        for (let k = p; k <= i; k++) a = (a * (p - 1) + tr(k)) / p;
        return a;
    },
    stdPop(xs: number[], i: number, p: number): number {
        if (i < p - 1) return NaN;
        const m = naive.sma(xs, i, p);
        let v = 0;
        for (let k = i - p + 1; k <= i; k++) v += (xs[k] - m) ** 2;
        return Math.sqrt(v / p);
    },
    stochK(bars: Bar[], i: number, p: number): number {
        if (i < p - 1) return NaN;
        let hh = -Infinity, ll = Infinity;
        for (let k = i - p + 1; k <= i; k++) {
            if (bars[k].high > hh) hh = bars[k].high;
            if (bars[k].low < ll) ll = bars[k].low;
        }
        return hh === ll ? 50 : ((bars[i].close - ll) / (hh - ll)) * 100;
    },
};

/** A minimal valid spec to mutate in validation tests. */
function baseSpec(): any {
    return {
        name: 'test',
        symbol: 'EUR/USD',
        timeframe: '1h',
        indicators: { rsi: { type: 'RSI', period: 14 } },
        entry: { long: { crossesAbove: ['rsi', 30] } },
        exit: { stopLoss: { pips: 50 } },
        sizing: { riskPercent: 1 },
    };
}

function main() {
    // ══════════════════════════════════════════════════════════════
    section('validation — a good spec passes, bad ones name their path');
    // ══════════════════════════════════════════════════════════════
    {
        check('base spec is valid', validateSpec(baseSpec()).ok, true);

        const cases: { name: string; mutate: (s: any) => void; path: string }[] = [
            { name: 'unknown top-level key', mutate: s => { s.magic = 1; }, path: 'magic' },
            { name: 'missing stopLoss', mutate: s => { delete s.exit.stopLoss; }, path: 'exit.stopLoss' },
            { name: 'unknown indicator reference', mutate: s => { s.entry.long = { gt: ['emaX', 1] }; }, path: 'entry.long.gt[0]' },
            { name: 'two-constant crossover', mutate: s => { s.entry.long = { crossesAbove: [1, 2] }; }, path: 'entry.long.crossesAbove' },
            { name: 'bad timeframe', mutate: s => { s.timeframe = '2h'; }, path: 'timeframe' },
            { name: 'htf below spec timeframe', mutate: s => { s.indicators.rsi.timeframe = '15m'; }, path: 'indicators.rsi.timeframe' },
            { name: 'field on single-output indicator', mutate: s => { s.entry.long = { gt: ['rsi.hist', 1] }; }, path: 'entry.long.gt[0]' },
            { name: 'MACD referenced without a field', mutate: s => { s.indicators.m = { type: 'MACD', fast: 12, slow: 26, signal: 9 }; s.entry.long = { gt: ['m', 0] }; }, path: 'entry.long.gt[0]' },
            { name: 'MACD fast >= slow', mutate: s => { s.indicators.m = { type: 'MACD', fast: 26, slow: 12, signal: 9 }; }, path: 'indicators.m' },
            { name: 'sizing with both keys', mutate: s => { s.sizing = { riskPercent: 1, fixedLots: 1 }; }, path: 'sizing' },
            { name: 'risk out of range', mutate: s => { s.sizing = { riskPercent: 50 }; }, path: 'sizing.riskPercent' },
            { name: 'empty entry', mutate: s => { s.entry = {}; }, path: 'entry' },
            { name: 'unknown filter', mutate: s => { s.filters = [{ moon: 'full' }]; }, path: 'filters[0]' },
            { name: 'indicator id shadows a source', mutate: s => { s.indicators.close = { type: 'SMA', period: 5 }; }, path: 'indicators.close' },
            { name: 'rising on a constant', mutate: s => { s.entry.long = { rising: [5, 3] }; }, path: 'entry.long.rising[0]' },
            { name: 'unknown operator', mutate: s => { s.entry.long = { near: ['close', 1] }; }, path: 'entry.long' },
        ];
        for (const c of cases) {
            const s = baseSpec();
            c.mutate(s);
            const res = validateSpec(s);
            check(`rejects: ${c.name}`, res.ok, false);
            check(`  …error names ${c.path}`,
                res.errors.some(e => e.path.startsWith(c.path)), true);
        }

        // node budget: 100 leaves under one `any`
        const s = baseSpec();
        s.entry.long = { any: Array.from({ length: 100 }, () => ({ gt: ['close', 0] })) };
        check('rejects an oversized condition tree', validateSpec(s).ok, false);
    }

    // ══════════════════════════════════════════════════════════════
    section('indicators — incremental vs naive reference, 300 bars');
    // ══════════════════════════════════════════════════════════════
    {
        const bars = randomBars(300);
        const closes = bars.map(b => b.close);
        const hl2 = bars.map(b => sourceValue(b, 'hl2'));

        const sma = createIndicator({ type: 'SMA', period: 20 });
        const smaHl2 = createIndicator({ type: 'SMA', period: 7, source: 'hl2' });
        const ema = createIndicator({ type: 'EMA', period: 12 });
        const rsi = createIndicator({ type: 'RSI', period: 14 });
        const atr = createIndicator({ type: 'ATR', period: 14 });
        const macd = createIndicator({ type: 'MACD', fast: 12, slow: 26, signal: 9 });
        const bb = createIndicator({ type: 'BBANDS', period: 20, mult: 2 });
        const stoch = createIndicator({ type: 'STOCH', kPeriod: 14, dPeriod: 3 });
        const hi = createIndicator({ type: 'HIGHEST', period: 10 });

        let worst: Record<string, number> = {};
        const track = (name: string, got: number, want: number) => {
            if (Number.isNaN(got) !== Number.isNaN(want)) {
                worst[name] = Infinity;
                return;
            }
            if (Number.isNaN(got)) return;
            const d = Math.abs(got - want) / Math.max(1, Math.abs(want));
            worst[name] = Math.max(worst[name] ?? 0, d);
        };

        const highs = bars.map(b => b.high);
        for (let i = 0; i < bars.length; i++) {
            const b = bars[i];
            sma.update(b); smaHl2.update(b); ema.update(b); rsi.update(b);
            atr.update(b); macd.update(b); bb.update(b); stoch.update(b); hi.update(b);

            track('SMA', sma.value(), naive.sma(closes, i, 20));
            track('SMA/hl2', smaHl2.value(), naive.sma(hl2, i, 7));
            track('EMA', ema.value(), naive.ema(closes, i, 12));
            track('RSI', rsi.value(), naive.rsi(closes, i, 14));
            track('ATR', atr.value(), naive.atr(bars, i, 14));
            track('MACD.macd', macd.value('macd'),
                i >= 25 ? naive.ema(closes, i, 12) - naive.ema(closes, i, 26) : NaN);
            {
                const mid = naive.sma(closes, i, 20);
                const sd = naive.stdPop(closes, i, 20);
                track('BB.middle', bb.value('middle'), mid);
                track('BB.upper', bb.value('upper'), Number.isNaN(mid) ? NaN : mid + 2 * sd);
                track('BB.lower', bb.value('lower'), Number.isNaN(mid) ? NaN : mid - 2 * sd);
            }
            track('STOCH.k', stoch.value('k'), naive.stochK(bars, i, 14));
            track('HIGHEST', hi.value(), i >= 9 ? Math.max(...highs.slice(i - 9, i + 1)) : NaN);
        }

        for (const [name, w] of Object.entries(worst)) {
            check(`${name} matches reference (worst rel. err ${w.toExponential(1)})`, w < 1e-9, true);
        }

        // MACD signal line: EMA(9) of the macd stream, seeded the same way.
        {
            const macd2 = createIndicator({ type: 'MACD', fast: 3, slow: 6, signal: 3 });
            const macdVals: number[] = [];
            let worstSig = 0;
            for (let i = 0; i < bars.length; i++) {
                macd2.update(bars[i]);
                const m = macd2.value('macd');
                if (!Number.isNaN(m)) macdVals.push(m);
                const sig = macd2.value('signal');
                const ref = naive.ema(macdVals, macdVals.length - 1, 3);
                if (!Number.isNaN(sig) && !Number.isNaN(ref)) {
                    worstSig = Math.max(worstSig, Math.abs(sig - ref) / Math.max(1, Math.abs(ref)));
                }
            }
            check(`MACD.signal matches reference (worst ${worstSig.toExponential(1)})`, worstSig < 1e-9, true);
        }

        // hand-checked tiny case: EMA(2) of [1,2,3] → seed (1+2)/2=1.5, then 1.5+2/3*(3-1.5)=2.5
        {
            const e = createIndicator({ type: 'EMA', period: 2 });
            for (const c of barsFromCloses([1, 2, 3])) e.update(c);
            check('EMA hand case', e.value(), 2.5, 1e-12);
        }
    }

    // ══════════════════════════════════════════════════════════════
    section('timeframe aggregation');
    // ══════════════════════════════════════════════════════════════
    {
        const t0 = Date.UTC(2026, 0, 5); // Monday 00:00
        const m1: Bar[] = Array.from({ length: 11 }, (_, i) => ({
            time: t0 + i * 60_000,
            open: 10 + i,
            high: 20 + i,
            low: 5 + i,
            close: 15 + i,
            volume: 1,
        }));

        const agg = new BarAggregator('5m');
        const out: Bar[] = [];
        for (const b of m1) {
            const done = agg.push(b);
            if (done) out.push(done);
        }
        check('two 5m bars completed from 11 one-minute bars', out.length, 2);
        check('first 5m open = first 1m open', out[0].open, 10);
        check('first 5m close = fifth 1m close', out[0].close, 19);
        check('first 5m high = max of five highs', out[0].high, 24);
        check('first 5m low = min of five lows', out[0].low, 5);
        check('first 5m volume = sum', out[0].volume, 5);
        check('first 5m time = bucket start', out[0].time, t0);
        check('second 5m time', out[1].time, t0 + 5 * 60_000);
        const partial = agg.flush();
        check('flush returns the forming bucket', partial?.open, 20);

        check('1w bucket anchors to Monday', bucketStart('1w', t0 + 3 * 86_400_000), t0);
        check('1d bucket anchors to UTC midnight', bucketStart('1d', t0 + 3_600_000 * 5), t0);
    }

    // ══════════════════════════════════════════════════════════════
    section('interpreter — crossover fires exactly once, at the cross');
    // ══════════════════════════════════════════════════════════════
    {
        const spec: StrategySpec = {
            name: 'cross test',
            symbol: 'EUR/USD',
            timeframe: '1h',
            entry: { long: { crossesAbove: ['close', 1.1000] } },
            exit: { stopLoss: { pips: 50 } },
            sizing: { fixedLots: 0.1 },
        };
        const strat = compileStrategy(spec);
        // below, below, touch-from-below→above, stays above, dips, crosses again
        const closes = [1.0990, 1.0995, 1.1005, 1.1010, 1.0980, 1.1002];
        const bars = barsFromCloses(closes);

        const fired: number[] = [];
        let state = initialBotState();
        bars.forEach((b, i) => {
            const r = strat.onBar('1h', b, state, { position: null });
            state = r.state;
            if (r.decision.enter) fired.push(i);
        });
        check('fires on the cross bars only', JSON.stringify(fired), JSON.stringify([2, 5]));

        // determinism: identical feed → identical decisions
        const strat2 = compileStrategy(spec);
        const fired2: number[] = [];
        let state2 = initialBotState();
        bars.forEach((b, i) => {
            const r = strat2.onBar('1h', b, state2, { position: null });
            state2 = r.state;
            if (r.decision.enter) fired2.push(i);
        });
        check('identical feed produces identical decisions', JSON.stringify(fired2), JSON.stringify(fired));
    }

    // ══════════════════════════════════════════════════════════════
    section('interpreter — warm-up never trades');
    // ══════════════════════════════════════════════════════════════
    {
        const spec: StrategySpec = {
            name: 'warmup',
            symbol: 'EUR/USD',
            timeframe: '1h',
            indicators: { fast: { type: 'EMA', period: 3 }, slow: { type: 'EMA', period: 8 } },
            entry: { long: { gt: ['fast', 'slow'] } },
            exit: { stopLoss: { atrMultiple: 1.5 } }, // hidden ATR(14) must also be ready
            sizing: { riskPercent: 1 },
        };
        const strat = compileStrategy(spec);
        // strongly rising series: fast>slow as soon as both exist, but the
        // ATR-based stop cannot be priced before ATR(14) is ready at bar 14.
        const bars = barsFromCloses(Array.from({ length: 30 }, (_, i) => 1.1 + i * 0.001));
        let firstEntry = -1;
        let state = initialBotState();
        bars.forEach((b, i) => {
            const r = strat.onBar('1h', b, state, { position: null });
            state = r.state;
            if (firstEntry === -1 && r.decision.enter) firstEntry = i;
        });
        check('no entry before the slowest input is ready', firstEntry >= 13, true);
        check('an entry does eventually fire', firstEntry !== -1, true);
    }

    // ══════════════════════════════════════════════════════════════
    section('interpreter — full trade cycle with timeStop and cooldown');
    // ══════════════════════════════════════════════════════════════
    {
        const spec: StrategySpec = {
            name: 'cycle',
            symbol: 'EUR/USD',
            timeframe: '1h',
            entry: { long: { gt: ['close', 0] } }, // always wants in
            exit: { stopLoss: { pips: 50 }, takeProfit: { rMultiple: 2 }, timeStop: { bars: 3 } },
            sizing: { fixedLots: 0.1 },
            limits: { cooldownBars: 2 },
        };
        const strat = compileStrategy(spec);
        // 13 bars: enter(0), 3 in position, timeStop(3), 2 cooldown, repeat
        const bars = barsFromCloses(Array.from({ length: 13 }, (_, i) => 1.1 + i * 0.0001));

        // drive it like the bot runner would
        let state = initialBotState();
        let position: { side: 'BUY' | 'SELL' } | null = null;
        const log: string[] = [];
        for (const b of bars) {
            const r = strat.onBar('1h', b, state, { position });
            state = r.state;
            if (r.decision.enter) {
                position = { side: r.decision.enter.side };
                log.push('E');
                // check the price arithmetic once, on the first entry
                if (log.filter(x => x === 'E').length === 1) {
                    const sl = r.decision.enter.stopLossPrice;
                    const tp = r.decision.enter.takeProfitPrice!;
                    check('SL = close - 50 pips', sl, +(b.close - 0.0050).toFixed(5), 1e-9);
                    check('TP = close + 2R', tp, +(b.close + 0.0100).toFixed(5), 1e-9);
                }
            } else if (r.decision.exit) {
                position = null;
                log.push(`X:${r.decision.exit.reason}`);
            } else {
                log.push('.');
            }
        }
        // bar0 enter; bars1-3 in position (timeStop at 3rd); cooldown 2 bars; re-enter; repeat
        check('cycle sequence', log.join(' '),
            'E . . X:TIME_STOP . . E . . X:TIME_STOP . . E');
    }

    // ══════════════════════════════════════════════════════════════
    section('interpreter — signal exit');
    // ══════════════════════════════════════════════════════════════
    {
        const spec: StrategySpec = {
            name: 'sig exit',
            symbol: 'EUR/USD',
            timeframe: '1h',
            entry: { long: { crossesAbove: ['close', 1.1] } },
            exit: {
                stopLoss: { pips: 100 },
                signal: { long: { lt: ['close', 1.095] } },
            },
            sizing: { fixedLots: 0.1 },
        };
        const strat = compileStrategy(spec);
        const closes = [1.099, 1.101, 1.102, 1.101, 1.094, 1.093];
        const bars = barsFromCloses(closes);

        let state = initialBotState();
        let position: { side: 'BUY' | 'SELL' } | null = null;
        const log: string[] = [];
        for (const b of bars) {
            const r = strat.onBar('1h', b, state, { position });
            state = r.state;
            if (r.decision.enter) { position = { side: r.decision.enter.side }; log.push('E'); }
            else if (r.decision.exit) { position = null; log.push('X'); }
            else log.push('.');
        }
        check('enters at cross, exits on the signal bar', log.join(''), '.E..X.');
    }

    // ══════════════════════════════════════════════════════════════
    section('interpreter — session and spread filters');
    // ══════════════════════════════════════════════════════════════
    {
        const mkSpec = (filters: any[]): StrategySpec => ({
            name: 'filters',
            symbol: 'EUR/USD',
            timeframe: '1h',
            entry: { long: { gt: ['close', 0] } },
            exit: { stopLoss: { pips: 50 } },
            sizing: { fixedLots: 0.1 },
            filters,
        });

        const tryBar = (spec: StrategySpec, openHourUtc: number, spreadPips?: number): boolean => {
            const strat = compileStrategy(spec);
            const bar: Bar = {
                time: Date.UTC(2026, 0, 5, openHourUtc), // Monday
                open: 1.1, high: 1.1002, low: 1.0998, close: 1.1001, volume: 10,
            };
            const r = strat.onBar('1h', bar, initialBotState(), { position: null, spreadPips });
            return !!r.decision.enter;
        };

        const london = mkSpec([{ session: 'london' }]);
        check('bar closing 08:00 UTC passes london', tryBar(london, 7), true);
        check('bar closing 21:00 UTC blocked by london', tryBar(london, 20), false);

        const sydney = mkSpec([{ session: 'sydney' }]); // 21–06, wraps midnight
        check('bar closing 22:00 passes sydney (wrap)', tryBar(sydney, 21), true);
        check('bar closing 05:00 passes sydney (wrap)', tryBar(sydney, 4), true);
        check('bar closing 12:00 blocked by sydney', tryBar(sydney, 11), false);

        const weekday = mkSpec([{ weekdaysUtc: [1, 2, 3] }]); // Mon–Wed
        check('Monday passes the weekday filter', tryBar(weekday, 7), true);

        const spread = mkSpec([{ maxSpreadPips: 1.5 }]);
        check('tight spread passes', tryBar(spread, 7, 1.0), true);
        check('wide spread blocked', tryBar(spread, 7, 3.0), false);
        check('unknown spread passes (plain backtest)', tryBar(spread, 7, undefined), true);
    }

    // ══════════════════════════════════════════════════════════════
    section('interpreter — daily trade limit resets on the UTC day');
    // ══════════════════════════════════════════════════════════════
    {
        const spec: StrategySpec = {
            name: 'daily cap',
            symbol: 'EUR/USD',
            timeframe: '1h',
            entry: { long: { gt: ['close', 0] } },
            exit: { stopLoss: { pips: 50 } },
            sizing: { fixedLots: 0.1 },
            limits: { maxTradesPerDay: 2 },
        };
        const strat = compileStrategy(spec);
        // 30 hourly bars spanning a UTC midnight (start 20:00 Monday)
        const bars = barsFromCloses(
            Array.from({ length: 30 }, (_, i) => 1.1 + i * 0.0001),
            Date.UTC(2026, 0, 5, 20),
        );
        let state = initialBotState();
        const perDay = new Map<string, number>();
        for (const b of bars) {
            // always flat: every accepted entry is immediately abandoned, so
            // the counter alone is what limits us
            const r = strat.onBar('1h', b, state, { position: null });
            state = r.state;
            if (r.decision.enter) {
                const day = String(Math.floor((b.time + TIMEFRAME_MS['1h']) / 86_400_000));
                perDay.set(day, (perDay.get(day) ?? 0) + 1);
            }
        }
        check('never more than 2 entries in any UTC day',
            Math.max(...perDay.values()), 2);
        check('the cap resets across days (2+ days saw entries)', perDay.size >= 2, true);
    }

    // ══════════════════════════════════════════════════════════════
    section('interpreter — higher-timeframe indicator, no look-ahead');
    // ══════════════════════════════════════════════════════════════
    {
        const spec: StrategySpec = {
            name: 'htf',
            symbol: 'EUR/USD',
            timeframe: '1h',
            indicators: { htfSma: { type: 'SMA', period: 2, timeframe: '4h' } },
            entry: { long: { gt: ['close', 'htfSma'] } },
            exit: { stopLoss: { pips: 50 } },
            sizing: { fixedLots: 0.1 },
        };
        const strat = compileStrategy(spec);
        check('strategy subscribes to both timeframes',
            JSON.stringify([...strat.timeframes].sort()), JSON.stringify(['1h', '4h']));

        // Feed 1h bars; aggregate to 4h ourselves and feed those too, the way
        // the runner will. htfSma(2) needs two CLOSED 4h bars → ready only
        // after the second 4h close (i.e. after eight 1h bars).
        const bars = barsFromCloses(Array.from({ length: 14 }, (_, i) => 1.1 + i * 0.001));
        const agg = new BarAggregator('4h');
        let state = initialBotState();
        let firstEntry = -1;
        bars.forEach((b, i) => {
            const done = agg.push(b);
            if (done) strat.onBar('4h', done, state); // htf update, no decision
            const r = strat.onBar('1h', b, state, { position: null });
            state = r.state;
            if (firstEntry === -1 && r.decision.enter) firstEntry = i;
        });
        // second 4h bar closes when bar index 8 arrives (buckets 0-3, 4-7)
        check('no entry before two 4h bars have CLOSED', firstEntry >= 8, true);
        check('entry does fire once the htf value exists', firstEntry !== -1, true);
    }

    // ══════════════════════════════════════════════════════════════
    section('interpreter — conflicting long+short signals stand aside');
    // ══════════════════════════════════════════════════════════════
    {
        const spec: StrategySpec = {
            name: 'conflict',
            symbol: 'EUR/USD',
            timeframe: '1h',
            entry: {
                long: { gt: ['close', 0] },
                short: { gt: ['close', 0] },
            },
            exit: { stopLoss: { pips: 50 } },
            sizing: { fixedLots: 0.1 },
        };
        const strat = compileStrategy(spec);
        const r = strat.onBar('1h', barsFromCloses([1.1, 1.1])[1], initialBotState(), { position: null });
        check('no decision when both sides fire', r.decision.enter === undefined, true);
    }
}

main();
console.log(`\n${'═'.repeat(64)}`);
if (failures.length === 0) {
    console.log(`✅ all ${passed} assertions passed`);
    process.exit(0);
} else {
    console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}\n`));
    process.exit(1);
}
