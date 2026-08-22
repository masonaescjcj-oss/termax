/**
 * CUSTOM INDICATOR EXPRESSIONS — phase 9's safe tier.
 *
 * A tiny arithmetic language over candle streams:
 *
 *     (close - EMA(close, 20)) / ATR(14) * 100
 *     SMA(hl2, 10) - REF(SMA(hl2, 10), 5)
 *     100 * (HIGHEST(high, 20) - close) / (HIGHEST(high, 20) - LOWEST(low, 20))
 *
 * Why a grammar and not user JavaScript: an expression cannot loop, cannot
 * allocate, cannot escape, and cannot be non-deterministic — the properties
 * the runner needs are guaranteed by CONSTRUCTION, not by sandbox hope.
 * (The isolated-vm escape of Aug 2026 is exactly why the code tier is a
 * separate, paid, QuickJS-in-WASM story — see the architecture doc.)
 *
 * Everything is incremental: compile once, feed closed bars, read a value —
 * the same contract as indicators.ts's Incr, so expressions register on the
 * same bus and cost O(1) per bar.
 */

import { Bar, Source } from './types';

export const MAX_EXPR_LENGTH = 400;
export const MAX_EXPR_NODES = 60;
export const MAX_EXPR_PERIOD = 500;

export interface ExprError { message: string; position?: number }

// ── AST ─────────────────────────────────────────────────────────────
type Node =
    | { kind: 'num'; value: number }
    | { kind: 'source'; name: Source }
    | { kind: 'unary'; op: '-'; arg: Node }
    | { kind: 'binary'; op: '+' | '-' | '*' | '/'; left: Node; right: Node }
    | { kind: 'call'; fn: string; args: Node[]; period?: number };

const SOURCES: Source[] = ['open', 'high', 'low', 'close', 'volume', 'hl2', 'hlc3', 'ohlc4'];

/** fn -> [series args, needs period]. ATR takes no series (reads H/L/C). */
const FUNCTIONS: Record<string, { seriesArgs: number; hasPeriod: boolean }> = {
    SMA: { seriesArgs: 1, hasPeriod: true },
    EMA: { seriesArgs: 1, hasPeriod: true },
    RSI: { seriesArgs: 1, hasPeriod: true },
    STDDEV: { seriesArgs: 1, hasPeriod: true },
    SUM: { seriesArgs: 1, hasPeriod: true },
    HIGHEST: { seriesArgs: 1, hasPeriod: true },
    LOWEST: { seriesArgs: 1, hasPeriod: true },
    REF: { seriesArgs: 1, hasPeriod: true },
    ATR: { seriesArgs: 0, hasPeriod: true },
    ABS: { seriesArgs: 1, hasPeriod: false },
    MIN: { seriesArgs: 2, hasPeriod: false },
    MAX: { seriesArgs: 2, hasPeriod: false },
};

// ── tokenizer ───────────────────────────────────────────────────────
interface Token { type: 'num' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma'; text: string; pos: number }

function tokenize(src: string): Token[] | ExprError {
    const tokens: Token[] = [];
    let i = 0;
    while (i < src.length) {
        const c = src[i];
        if (/\s/.test(c)) { i++; continue; }
        if (/[0-9.]/.test(c)) {
            let j = i;
            while (j < src.length && /[0-9.]/.test(src[j])) j++;
            const text = src.slice(i, j);
            if (!/^\d+(\.\d+)?$/.test(text)) return { message: `Malformed number "${text}"`, position: i };
            tokens.push({ type: 'num', text, pos: i });
            i = j; continue;
        }
        if (/[A-Za-z_]/.test(c)) {
            let j = i;
            while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
            tokens.push({ type: 'ident', text: src.slice(i, j), pos: i });
            i = j; continue;
        }
        if ('+-*/'.includes(c)) { tokens.push({ type: 'op', text: c, pos: i }); i++; continue; }
        if (c === '(') { tokens.push({ type: 'lparen', text: c, pos: i }); i++; continue; }
        if (c === ')') { tokens.push({ type: 'rparen', text: c, pos: i }); i++; continue; }
        if (c === ',') { tokens.push({ type: 'comma', text: c, pos: i }); i++; continue; }
        return { message: `Unexpected character "${c}"`, position: i };
    }
    return tokens;
}

// ── parser (precedence climbing) ────────────────────────────────────
export function parseExpr(src: string): { ok: true; ast: Node; nodes: number } | { ok: false; errors: ExprError[] } {
    if (typeof src !== 'string' || !src.trim()) return { ok: false, errors: [{ message: 'Expression is empty' }] };
    if (src.length > MAX_EXPR_LENGTH) return { ok: false, errors: [{ message: `Expression longer than ${MAX_EXPR_LENGTH} characters` }] };

    const toks = tokenize(src);
    if (!Array.isArray(toks)) return { ok: false, errors: [toks] };

    let pos = 0;
    let nodes = 0;
    const errors: ExprError[] = [];
    const peek = () => toks[pos];
    const next = () => toks[pos++];
    const fail = (message: string, at?: Token): null => {
        errors.push({ message, position: at?.pos });
        return null;
    };
    const count = <T extends Node>(n: T): T => { nodes++; return n; };

    function parsePrimary(): Node | null {
        const t = peek();
        if (!t) return fail('Unexpected end of expression');
        if (t.type === 'num') { next(); return count({ kind: 'num', value: parseFloat(t.text) }); }
        if (t.type === 'lparen') {
            next();
            const inner = parseSum();
            if (!inner) return null;
            if (peek()?.type !== 'rparen') return fail('Missing ")"', peek());
            next();
            return inner;
        }
        if (t.type === 'op' && t.text === '-') {
            next();
            const arg = parsePrimary();
            return arg ? count({ kind: 'unary', op: '-', arg }) : null;
        }
        if (t.type === 'ident') {
            next();
            const name = t.text;
            if (peek()?.type === 'lparen') {
                const fn = name.toUpperCase();
                const spec = FUNCTIONS[fn];
                if (!spec) return fail(`Unknown function "${name}". Available: ${Object.keys(FUNCTIONS).join(', ')}`, t);
                next(); // (
                const args: Node[] = [];
                let period: number | undefined;
                for (let k = 0; k < spec.seriesArgs; k++) {
                    if (k > 0) {
                        if (peek()?.type !== 'comma') return fail(`"${fn}" expects ${spec.seriesArgs} series argument(s)`, peek());
                        next();
                    }
                    const arg = parseSum();
                    if (!arg) return null;
                    args.push(arg);
                }
                if (spec.hasPeriod) {
                    if (spec.seriesArgs > 0) {
                        if (peek()?.type !== 'comma') return fail(`"${fn}" needs a period, e.g. ${fn}(close, 14)`, peek());
                        next();
                    }
                    const p = peek();
                    if (p?.type !== 'num') return fail(`"${fn}" period must be a plain number`, p);
                    next();
                    period = parseFloat(p.text);
                    if (!Number.isInteger(period) || period < 1 || period > MAX_EXPR_PERIOD) {
                        return fail(`"${fn}" period must be an integer between 1 and ${MAX_EXPR_PERIOD}`, p);
                    }
                }
                if (peek()?.type !== 'rparen') return fail(`Missing ")" after ${fn}(...)`, peek());
                next();
                return count({ kind: 'call', fn, args, period });
            }
            const lower = name.toLowerCase() as Source;
            if (SOURCES.includes(lower)) return count({ kind: 'source', name: lower });
            return fail(`Unknown identifier "${name}". Price sources: ${SOURCES.join(', ')}`, t);
        }
        return fail(`Unexpected token "${t.text}"`, t);
    }

    function parseProduct(): Node | null {
        let left = parsePrimary();
        while (left && peek()?.type === 'op' && (peek().text === '*' || peek().text === '/')) {
            const op = next().text as '*' | '/';
            const right = parsePrimary();
            if (!right) return null;
            left = count({ kind: 'binary', op, left, right });
        }
        return left;
    }

    function parseSum(): Node | null {
        let left = parseProduct();
        while (left && peek()?.type === 'op' && (peek().text === '+' || peek().text === '-')) {
            const op = next().text as '+' | '-';
            const right = parseProduct();
            if (!right) return null;
            left = count({ kind: 'binary', op, left, right });
        }
        return left;
    }

    const ast = parseSum();
    if (ast && pos < toks.length) errors.push({ message: `Unexpected "${toks[pos].text}" after the expression`, position: toks[pos].pos });
    if (!ast || errors.length) return { ok: false, errors };
    if (nodes > MAX_EXPR_NODES) return { ok: false, errors: [{ message: `Expression too complex (${nodes} nodes, max ${MAX_EXPR_NODES})` }] };
    return { ok: true, ast, nodes };
}

// ── incremental streams ─────────────────────────────────────────────
interface Stream { update(bar: Bar): number }

class RingBuf {
    private buf: Float64Array;
    private idx = 0;
    private n = 0;
    constructor(cap: number) { this.buf = new Float64Array(cap); }
    push(x: number) { this.buf[this.idx] = x; this.idx = (this.idx + 1) % this.buf.length; if (this.n < this.buf.length) this.n++; }
    full(): boolean { return this.n === this.buf.length; }
    /** k = 0 newest, k = cap-1 oldest. */
    at(k: number): number { return this.buf[(this.idx - 1 - k + 2 * this.buf.length) % this.buf.length]; }
    get size(): number { return this.n; }
}

const src = (bar: Bar, name: Source): number => {
    switch (name) {
        case 'open': return bar.open;
        case 'high': return bar.high;
        case 'low': return bar.low;
        case 'close': return bar.close;
        case 'volume': return bar.volume;
        case 'hl2': return (bar.high + bar.low) / 2;
        case 'hlc3': return (bar.high + bar.low + bar.close) / 3;
        case 'ohlc4': return (bar.open + bar.high + bar.low + bar.close) / 4;
    }
};

function rolling(fn: string, input: Stream, period: number): Stream {
    switch (fn) {
        case 'SMA': case 'SUM': {
            const ring = new RingBuf(period);
            let sum = 0;
            return { update(bar) {
                const x = input.update(bar);
                if (!Number.isFinite(x)) return NaN;
                if (ring.full()) sum -= ring.at(period - 1);
                ring.push(x); sum += x;
                if (!ring.full()) return NaN;
                return fn === 'SUM' ? sum : sum / period;
            } };
        }
        case 'EMA': {
            const k = 2 / (period + 1);
            let seedSum = 0, seedN = 0, ema = NaN;
            return { update(bar) {
                const x = input.update(bar);
                if (!Number.isFinite(x)) return NaN;
                if (seedN < period) { seedSum += x; seedN++; if (seedN === period) ema = seedSum / period; return seedN === period ? ema : NaN; }
                ema = x * k + ema * (1 - k);
                return ema;
            } };
        }
        case 'RSI': {
            let prev = NaN, avgGain = NaN, avgLoss = NaN, warm = 0, gSum = 0, lSum = 0;
            return { update(bar) {
                const x = input.update(bar);
                if (!Number.isFinite(x)) return NaN;
                if (!Number.isFinite(prev)) { prev = x; return NaN; }
                const d = x - prev; prev = x;
                const g = Math.max(0, d), l = Math.max(0, -d);
                if (warm < period) {
                    gSum += g; lSum += l; warm++;
                    if (warm < period) return NaN;
                    avgGain = gSum / period; avgLoss = lSum / period;
                } else {
                    avgGain = (avgGain * (period - 1) + g) / period;
                    avgLoss = (avgLoss * (period - 1) + l) / period;
                }
                if (avgLoss === 0) return 100;
                return 100 - 100 / (1 + avgGain / avgLoss);
            } };
        }
        case 'STDDEV': {
            const ring = new RingBuf(period);
            let sum = 0, sumSq = 0;
            return { update(bar) {
                const x = input.update(bar);
                if (!Number.isFinite(x)) return NaN;
                if (ring.full()) { const old = ring.at(period - 1); sum -= old; sumSq -= old * old; }
                ring.push(x); sum += x; sumSq += x * x;
                if (!ring.full()) return NaN;
                const mean = sum / period;
                return Math.sqrt(Math.max(0, sumSq / period - mean * mean));
            } };
        }
        case 'HIGHEST': case 'LOWEST': {
            const ring = new RingBuf(period);
            return { update(bar) {
                const x = input.update(bar);
                if (!Number.isFinite(x)) return NaN;
                ring.push(x);
                if (!ring.full()) return NaN;
                let best = ring.at(0);
                for (let k = 1; k < period; k++) {
                    const v = ring.at(k);
                    if (fn === 'HIGHEST' ? v > best : v < best) best = v;
                }
                return best;
            } };
        }
        case 'REF': {
            const ring = new RingBuf(period + 1);
            return { update(bar) {
                const x = input.update(bar);
                if (!Number.isFinite(x)) return NaN;
                ring.push(x);
                if (ring.size <= period) return NaN;
                return ring.at(period);
            } };
        }
        default:
            throw new Error(`No rolling implementation for ${fn}`);
    }
}

function compileNode(node: Node): Stream {
    switch (node.kind) {
        case 'num': return { update: () => node.value };
        case 'source': return { update: (bar) => src(bar, node.name) };
        case 'unary': {
            const arg = compileNode(node.arg);
            return { update: (bar) => -arg.update(bar) };
        }
        case 'binary': {
            const left = compileNode(node.left);
            const right = compileNode(node.right);
            return { update(bar) {
                const a = left.update(bar);
                const b = right.update(bar);
                if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
                switch (node.op) {
                    case '+': return a + b;
                    case '-': return a - b;
                    case '*': return a * b;
                    case '/': return b === 0 ? NaN : a / b;
                }
            } };
        }
        case 'call': {
            if (node.fn === 'ABS') {
                const arg = compileNode(node.args[0]);
                return { update: (bar) => Math.abs(arg.update(bar)) };
            }
            if (node.fn === 'MIN' || node.fn === 'MAX') {
                const a = compileNode(node.args[0]);
                const b = compileNode(node.args[1]);
                const pick = node.fn === 'MIN' ? Math.min : Math.max;
                return { update(bar) {
                    const x = a.update(bar), y = b.update(bar);
                    if (!Number.isFinite(x) || !Number.isFinite(y)) return NaN;
                    return pick(x, y);
                } };
            }
            if (node.fn === 'ATR') {
                // True range straight off the bar — no input series.
                const period = node.period!;
                let prevClose = NaN, atr = NaN, warm = 0, sum = 0;
                return { update(bar) {
                    const tr = Number.isFinite(prevClose)
                        ? Math.max(bar.high - bar.low, Math.abs(bar.high - prevClose), Math.abs(bar.low - prevClose))
                        : bar.high - bar.low;
                    prevClose = bar.close;
                    if (warm < period) { sum += tr; warm++; if (warm === period) atr = sum / period; return warm === period ? atr : NaN; }
                    atr = (atr * (period - 1) + tr) / period;
                    return atr;
                } };
            }
            return rolling(node.fn, compileNode(node.args[0]), node.period!);
        }
    }
}

export interface CompiledExpr {
    /** Feed one CLOSED bar; NaN until every sub-window is warm. */
    update(bar: Bar): number;
    nodes: number;
}

export function compileExpr(source: string): { ok: true; expr: CompiledExpr } | { ok: false; errors: ExprError[] } {
    const parsed = parseExpr(source);
    if (!parsed.ok) return parsed;
    const stream = compileNode(parsed.ast);
    return { ok: true, expr: { update: (bar) => stream.update(bar), nodes: parsed.nodes } };
}

/** Batch helper: expression values over a bar array, oldest first. */
export function evalExprOverBars(source: string, bars: Bar[]):
    { ok: true; values: Array<{ time: number; value: number }> } | { ok: false; errors: ExprError[] } {
    const compiled = compileExpr(source);
    if (!compiled.ok) return compiled;
    const values: Array<{ time: number; value: number }> = [];
    for (const bar of bars) {
        const v = compiled.expr.update(bar);
        if (Number.isFinite(v)) values.push({ time: bar.time, value: v });
    }
    return { ok: true, values };
}
