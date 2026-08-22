/**
 * STRATEGY SPEC VALIDATION
 *
 * Strict on purpose. Specs arrive from two authors who both need hard walls:
 * the AI (whose retry loop feeds on precise, path-addressed errors) and users
 * (whose typos must fail loudly, not silently change a strategy's meaning).
 * Unknown keys are rejected rather than ignored — an ignored key is a rule
 * the author believes is active and is not.
 */

import {
    IndicatorDef, IndicatorType, INDICATOR_FIELDS,
    SESSION_HOURS_UTC, SOURCES, StrategySpec, TIMEFRAME_MS, TIMEFRAMES, Timeframe,
} from './types';

export interface SpecError {
    path: string;
    message: string;
}

export interface ValidationResult {
    ok: boolean;
    errors: SpecError[];
    /** Set only when ok — the same object, now typed. */
    spec?: StrategySpec;
}

/** Bounds chosen to keep any single bot cheap and any condition analysable. */
const MAX_INDICATORS = 12;
const MAX_CONDITION_NODES = 64;
const MAX_CONDITION_DEPTH = 8;
const MAX_PERIOD = 500;
const MAX_FILTERS = 8;
/** rising/falling look-back cap — also bounds operand history memory. */
export const MAX_LOOKBACK_BARS = 100;

const ID_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,23}$/;

const COMPARATORS = ['gt', 'gte', 'lt', 'lte'] as const;
const CROSSES = ['crossesAbove', 'crossesBelow'] as const;
const TRENDS = ['rising', 'falling'] as const;

/** Keys each indicator type accepts, beyond the common type/timeframe. */
const TYPE_KEYS: Record<IndicatorType, string[]> = {
    SMA: ['period', 'source'],
    EMA: ['period', 'source'],
    RSI: ['period', 'source'],
    ATR: ['period'],
    HIGHEST: ['period', 'source'],
    LOWEST: ['period', 'source'],
    MACD: ['fast', 'slow', 'signal', 'source'],
    BBANDS: ['period', 'mult', 'source'],
    STOCH: ['kPeriod', 'dPeriod'],
};

export function validateSpec(raw: unknown): ValidationResult {
    const errors: SpecError[] = [];
    const err = (path: string, message: string) => errors.push({ path, message });

    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return { ok: false, errors: [{ path: '', message: 'the spec must be a JSON object' }] };
    }
    const spec = raw as Record<string, any>;

    checkKeys(spec, '', ['name', 'symbol', 'timeframe', 'indicators', 'filters', 'entry', 'exit', 'sizing', 'limits'], err);

    // ── identity ──
    if (typeof spec.name !== 'string' || !spec.name.trim() || spec.name.length > 60) {
        err('name', 'must be a non-empty string of at most 60 characters');
    }
    if (typeof spec.symbol !== 'string' || !spec.symbol.trim() || spec.symbol.length > 20) {
        err('symbol', 'must be a non-empty string of at most 20 characters');
    }
    const specTf: Timeframe | null = TIMEFRAMES.includes(spec.timeframe) ? spec.timeframe : null;
    if (!specTf) {
        err('timeframe', `must be one of: ${TIMEFRAMES.join(', ')}`);
    }

    // ── indicators ──
    const indicators: Record<string, IndicatorDef> = {};
    if (spec.indicators !== undefined) {
        if (!isPlainObject(spec.indicators)) {
            err('indicators', 'must be an object of { id: definition }');
        } else {
            const ids = Object.keys(spec.indicators);
            if (ids.length > MAX_INDICATORS) {
                err('indicators', `at most ${MAX_INDICATORS} indicators per strategy`);
            }
            for (const id of ids) {
                const path = `indicators.${id}`;
                if (!ID_RE.test(id)) {
                    err(path, 'id must start with a letter and use only letters, digits and underscore (max 24 chars)');
                    continue;
                }
                if ((SOURCES as string[]).includes(id)) {
                    err(path, `id shadows the price source "${id}" — pick another name`);
                    continue;
                }
                const def = spec.indicators[id];
                if (validateIndicatorDef(def, path, specTf, errors, err)) {
                    indicators[id] = def as IndicatorDef;
                }
            }
        }
    }

    const operandCheck = (op: unknown, path: string) => validateOperand(op, path, indicators, err);

    // ── filters ──
    if (spec.filters !== undefined) {
        if (!Array.isArray(spec.filters)) {
            err('filters', 'must be an array');
        } else {
            if (spec.filters.length > MAX_FILTERS) err('filters', `at most ${MAX_FILTERS} filters`);
            spec.filters.forEach((f: unknown, i: number) => validateFilter(f, `filters[${i}]`, err));
        }
    }

    // ── entry ──
    if (!isPlainObject(spec.entry)) {
        err('entry', 'is required and must be an object with "long" and/or "short"');
    } else {
        checkKeys(spec.entry, 'entry', ['long', 'short'], err);
        if (spec.entry.long === undefined && spec.entry.short === undefined) {
            err('entry', 'must define at least one of "long" or "short"');
        }
        for (const side of ['long', 'short'] as const) {
            if (spec.entry[side] !== undefined) {
                validateCondition(spec.entry[side], `entry.${side}`, operandCheck, err);
            }
        }
    }

    // ── exit ──
    if (!isPlainObject(spec.exit)) {
        err('exit', 'is required and must be an object');
    } else {
        checkKeys(spec.exit, 'exit', ['stopLoss', 'takeProfit', 'trailingStop', 'timeStop', 'signal'], err);

        if (spec.exit.stopLoss === undefined) {
            err('exit.stopLoss', 'is required — a strategy must define its stop loss');
        } else {
            validateDistance(spec.exit.stopLoss, 'exit.stopLoss', false, err);
        }
        if (spec.exit.takeProfit !== undefined) {
            validateDistance(spec.exit.takeProfit, 'exit.takeProfit', true, err);
        }
        if (spec.exit.trailingStop !== undefined) {
            validateDistance(spec.exit.trailingStop, 'exit.trailingStop', false, err);
        }
        if (spec.exit.timeStop !== undefined) {
            if (!isPlainObject(spec.exit.timeStop)) {
                err('exit.timeStop', 'must be an object like { "bars": 40 }');
            } else {
                checkKeys(spec.exit.timeStop, 'exit.timeStop', ['bars'], err);
                if (!isInt(spec.exit.timeStop.bars, 1, 10_000)) {
                    err('exit.timeStop.bars', 'must be an integer between 1 and 10000');
                }
            }
        }
        if (spec.exit.signal !== undefined) {
            if (!isPlainObject(spec.exit.signal)) {
                err('exit.signal', 'must be an object with "long" and/or "short" conditions');
            } else {
                checkKeys(spec.exit.signal, 'exit.signal', ['long', 'short'], err);
                for (const side of ['long', 'short'] as const) {
                    if (spec.exit.signal[side] !== undefined) {
                        validateCondition(spec.exit.signal[side], `exit.signal.${side}`, operandCheck, err);
                    }
                }
            }
        }
    }

    // ── sizing ──
    if (!isPlainObject(spec.sizing)) {
        err('sizing', 'is required — either { "riskPercent": n } or { "fixedLots": n }');
    } else {
        const keys = Object.keys(spec.sizing);
        if (keys.length !== 1 || !['riskPercent', 'fixedLots'].includes(keys[0])) {
            err('sizing', 'must have exactly one of "riskPercent" or "fixedLots"');
        } else if (keys[0] === 'riskPercent') {
            if (!isNum(spec.sizing.riskPercent, 0.01, 5)) {
                err('sizing.riskPercent', 'must be a number between 0.01 and 5 (percent of equity risked per trade)');
            }
        } else if (!isNum(spec.sizing.fixedLots, 0.01, 100)) {
            err('sizing.fixedLots', 'must be a number between 0.01 and 100');
        }
    }

    // ── limits ──
    if (spec.limits !== undefined) {
        if (!isPlainObject(spec.limits)) {
            err('limits', 'must be an object');
        } else {
            checkKeys(spec.limits, 'limits', ['maxOpenPositions', 'maxTradesPerDay', 'cooldownBars'], err);
            if (spec.limits.maxOpenPositions !== undefined && !isInt(spec.limits.maxOpenPositions, 1, 10)) {
                err('limits.maxOpenPositions', 'must be an integer between 1 and 10');
            }
            if (spec.limits.maxTradesPerDay !== undefined && !isInt(spec.limits.maxTradesPerDay, 1, 100)) {
                err('limits.maxTradesPerDay', 'must be an integer between 1 and 100');
            }
            if (spec.limits.cooldownBars !== undefined && !isInt(spec.limits.cooldownBars, 0, 500)) {
                err('limits.cooldownBars', 'must be an integer between 0 and 500');
            }
        }
    }

    return errors.length
        ? { ok: false, errors }
        : { ok: true, errors, spec: spec as StrategySpec };
}

// ═══════════════════════════════════════════════════════════════════
//  Pieces
// ═══════════════════════════════════════════════════════════════════

function validateIndicatorDef(
    def: unknown,
    path: string,
    specTf: Timeframe | null,
    errors: SpecError[],
    err: (p: string, m: string) => void
): boolean {
    if (!isPlainObject(def)) {
        err(path, 'must be an object with a "type"');
        return false;
    }
    const d = def as Record<string, any>;
    const type = d.type as IndicatorType;
    if (!(type in INDICATOR_FIELDS)) {
        err(`${path}.type`, `unknown indicator type — use one of: ${Object.keys(INDICATOR_FIELDS).join(', ')}`);
        return false;
    }

    checkKeys(d, path, ['type', 'timeframe', ...TYPE_KEYS[type]], err);

    const before = errors.length;

    const needPeriod = ['SMA', 'EMA', 'RSI', 'ATR', 'BBANDS', 'HIGHEST', 'LOWEST'].includes(type);
    if (needPeriod && !isInt(d.period, type === 'RSI' ? 2 : 1, MAX_PERIOD)) {
        err(`${path}.period`, `must be an integer between ${type === 'RSI' ? 2 : 1} and ${MAX_PERIOD}`);
    }
    if (d.source !== undefined && !SOURCES.includes(d.source)) {
        err(`${path}.source`, `must be one of: ${SOURCES.join(', ')}`);
    }
    if (type === 'MACD') {
        if (!isInt(d.fast, 1, MAX_PERIOD)) err(`${path}.fast`, `must be an integer between 1 and ${MAX_PERIOD}`);
        if (!isInt(d.slow, 1, MAX_PERIOD)) err(`${path}.slow`, `must be an integer between 1 and ${MAX_PERIOD}`);
        if (!isInt(d.signal, 1, MAX_PERIOD)) err(`${path}.signal`, `must be an integer between 1 and ${MAX_PERIOD}`);
        if (isInt(d.fast, 1, MAX_PERIOD) && isInt(d.slow, 1, MAX_PERIOD) && d.fast >= d.slow) {
            err(path, 'MACD "fast" must be smaller than "slow"');
        }
    }
    if (type === 'BBANDS' && !isNum(d.mult, 0.1, 10)) {
        err(`${path}.mult`, 'must be a number between 0.1 and 10');
    }
    if (type === 'STOCH') {
        if (!isInt(d.kPeriod, 1, MAX_PERIOD)) err(`${path}.kPeriod`, `must be an integer between 1 and ${MAX_PERIOD}`);
        if (!isInt(d.dPeriod, 1, MAX_PERIOD)) err(`${path}.dPeriod`, `must be an integer between 1 and ${MAX_PERIOD}`);
    }
    if (d.timeframe !== undefined) {
        if (!TIMEFRAMES.includes(d.timeframe)) {
            err(`${path}.timeframe`, `must be one of: ${TIMEFRAMES.join(', ')}`);
        } else if (specTf && TIMEFRAME_MS[d.timeframe as Timeframe] < TIMEFRAME_MS[specTf]) {
            err(`${path}.timeframe`, `must be the strategy timeframe (${specTf}) or higher — lower timeframes would need intra-bar data the strategy does not see`);
        }
    }

    return errors.length === before;
}

function validateOperand(
    op: unknown,
    path: string,
    indicators: Record<string, IndicatorDef>,
    err: (p: string, m: string) => void
): void {
    if (typeof op === 'number') {
        if (!Number.isFinite(op)) err(path, 'numeric operand must be finite');
        return;
    }
    if (typeof op !== 'string' || !op.trim()) {
        err(path, 'operand must be a number, a price source, or an indicator reference');
        return;
    }
    if ((SOURCES as string[]).includes(op)) return;

    const [id, field, extra] = op.split('.');
    if (extra !== undefined) {
        err(path, `"${op}" has too many dots — use "id" or "id.field"`);
        return;
    }
    const def = indicators[id];
    if (!def) {
        err(path, `"${id}" is not a declared indicator or price source`);
        return;
    }
    const fields = INDICATOR_FIELDS[def.type];
    if (fields.length === 1) {
        if (field !== undefined && field !== 'value') {
            err(path, `"${id}" (${def.type}) has a single output — reference it as "${id}"`);
        }
    } else if (field === undefined) {
        err(path, `"${id}" (${def.type}) has multiple outputs — reference one of: ${fields.map(f => `${id}.${f}`).join(', ')}`);
    } else if (!fields.includes(field)) {
        err(path, `"${id}.${field}" — ${def.type} outputs are: ${fields.join(', ')}`);
    }
}

function validateCondition(
    cond: unknown,
    path: string,
    operandCheck: (op: unknown, path: string) => void,
    err: (p: string, m: string) => void
): void {
    const budget = { nodes: 0 };
    walkCondition(cond, path, 0, budget, operandCheck, err);
    if (budget.nodes > MAX_CONDITION_NODES) {
        err(path, `condition tree has ${budget.nodes} nodes — the maximum is ${MAX_CONDITION_NODES}`);
    }
}

function walkCondition(
    cond: unknown,
    path: string,
    depth: number,
    budget: { nodes: number },
    operandCheck: (op: unknown, path: string) => void,
    err: (p: string, m: string) => void
): void {
    budget.nodes++;
    if (budget.nodes > MAX_CONDITION_NODES) return; // reported once by the caller

    if (depth > MAX_CONDITION_DEPTH) {
        err(path, `conditions may nest at most ${MAX_CONDITION_DEPTH} levels deep`);
        return;
    }
    if (!isPlainObject(cond)) {
        err(path, 'condition must be an object with exactly one operator key');
        return;
    }
    const keys = Object.keys(cond as object);
    if (keys.length !== 1) {
        err(path, `condition must have exactly one operator key, got: ${keys.join(', ') || 'none'}`);
        return;
    }
    const key = keys[0];
    const value = (cond as Record<string, any>)[key];

    if ((COMPARATORS as readonly string[]).includes(key) || (CROSSES as readonly string[]).includes(key)) {
        if (!Array.isArray(value) || value.length !== 2) {
            err(`${path}.${key}`, 'takes exactly two operands: [a, b]');
            return;
        }
        operandCheck(value[0], `${path}.${key}[0]`);
        operandCheck(value[1], `${path}.${key}[1]`);
        if ((CROSSES as readonly string[]).includes(key)
            && typeof value[0] === 'number' && typeof value[1] === 'number') {
            err(`${path}.${key}`, 'two constants can never cross — at least one operand must be a series');
        }
        return;
    }

    if ((TRENDS as readonly string[]).includes(key)) {
        if (!Array.isArray(value) || value.length !== 2) {
            err(`${path}.${key}`, 'takes [operand, bars]');
            return;
        }
        if (typeof value[0] === 'number') {
            err(`${path}.${key}[0]`, 'a constant cannot rise or fall — the operand must be a series');
        } else {
            operandCheck(value[0], `${path}.${key}[0]`);
        }
        if (!isInt(value[1], 1, MAX_LOOKBACK_BARS)) {
            err(`${path}.${key}[1]`, `bars must be an integer between 1 and ${MAX_LOOKBACK_BARS}`);
        }
        return;
    }

    if (key === 'all' || key === 'any') {
        if (!Array.isArray(value) || value.length === 0) {
            err(`${path}.${key}`, 'takes a non-empty array of conditions');
            return;
        }
        value.forEach((c: unknown, i: number) =>
            walkCondition(c, `${path}.${key}[${i}]`, depth + 1, budget, operandCheck, err));
        return;
    }

    if (key === 'not') {
        walkCondition(value, `${path}.not`, depth + 1, budget, operandCheck, err);
        return;
    }

    err(path, `unknown operator "${key}" — use gt, gte, lt, lte, crossesAbove, crossesBelow, rising, falling, all, any, not`);
}

function validateFilter(f: unknown, path: string, err: (p: string, m: string) => void): void {
    if (!isPlainObject(f)) {
        err(path, 'filter must be an object with exactly one key');
        return;
    }
    const keys = Object.keys(f as object);
    if (keys.length !== 1) {
        err(path, 'filter must have exactly one key');
        return;
    }
    const key = keys[0];
    const value = (f as Record<string, any>)[key];

    switch (key) {
        case 'session':
            if (!(value in SESSION_HOURS_UTC)) {
                err(`${path}.session`, `must be one of: ${Object.keys(SESSION_HOURS_UTC).join(', ')}`);
            }
            return;
        case 'hoursUtc':
            if (!Array.isArray(value) || value.length !== 2
                || !isInt(value[0], 0, 23) || !isInt(value[1], 0, 23) || value[0] === value[1]) {
                err(`${path}.hoursUtc`, 'must be [fromHour, toHour], integers 0–23, from ≠ to (may wrap midnight)');
            }
            return;
        case 'weekdaysUtc':
            if (!Array.isArray(value) || value.length === 0
                || !value.every((d: unknown) => isInt(d, 0, 6))
                || new Set(value).size !== value.length) {
                err(`${path}.weekdaysUtc`, 'must be a non-empty array of distinct integers 0 (Sunday) to 6 (Saturday)');
            }
            return;
        case 'maxSpreadPips':
            if (!isNum(value, 0.01, 1000)) {
                err(`${path}.maxSpreadPips`, 'must be a number between 0.01 and 1000');
            }
            return;
        default:
            err(path, `unknown filter "${key}" — use session, hoursUtc, weekdaysUtc or maxSpreadPips`);
    }
}

function validateDistance(
    v: unknown,
    path: string,
    allowRMultiple: boolean,
    err: (p: string, m: string) => void
): void {
    if (!isPlainObject(v)) {
        err(path, `must be an object like { "pips": n } or { "atrMultiple": n }${allowRMultiple ? ' or { "rMultiple": n }' : ''}`);
        return;
    }
    const keys = Object.keys(v as object);
    const allowed = allowRMultiple ? ['pips', 'atrMultiple', 'rMultiple'] : ['pips', 'atrMultiple'];
    if (keys.length !== 1 || !allowed.includes(keys[0])) {
        err(path, `must have exactly one of: ${allowed.join(', ')}`);
        return;
    }
    const value = (v as Record<string, any>)[keys[0]];
    const ranges: Record<string, [number, number]> = {
        pips: [0.1, 100_000],
        atrMultiple: [0.1, 100],
        rMultiple: [0.1, 100],
    };
    const [lo, hi] = ranges[keys[0]];
    if (!isNum(value, lo, hi)) {
        err(`${path}.${keys[0]}`, `must be a number between ${lo} and ${hi}`);
    }
}

// ═══════════════════════════════════════════════════════════════════
//  Small helpers
// ═══════════════════════════════════════════════════════════════════

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown, lo: number, hi: number): boolean {
    return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
}

function isInt(v: unknown, lo: number, hi: number): boolean {
    return typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
}

function checkKeys(
    obj: Record<string, unknown>,
    base: string,
    allowed: string[],
    err: (p: string, m: string) => void
): void {
    for (const k of Object.keys(obj)) {
        if (!allowed.includes(k)) {
            err(base ? `${base}.${k}` : k, `unknown key — allowed here: ${allowed.join(', ')}`);
        }
    }
}

