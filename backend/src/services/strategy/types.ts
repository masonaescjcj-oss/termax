/**
 * STRATEGY SPECIFICATION v1 — the data format a bot *is*.
 *
 * A bot is not a program: it is this document, validated against a strict
 * grammar and interpreted by one engine shared by every bot. That choice is
 * what makes a thousand bots cost megabytes instead of gigabytes, lets the AI
 * author bots that are checked before they are accepted, and makes backtests
 * structurally identical to live execution (same interpreter, different
 * clock). See docs/ai-architecture.md §1.
 *
 * The grammar is deliberately narrow. Every construct added here is one the
 * AI must generate correctly, the interpreter must evaluate, the backtest
 * must reproduce and the plain-language renderer must describe — so it grows
 * from evidence of real user demand, not speculation.
 */

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

export const TIMEFRAME_MS: Record<Timeframe, number> = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
    '4h': 14_400_000,
    '1d': 86_400_000,
    '1w': 604_800_000,
};

export const TIMEFRAMES = Object.keys(TIMEFRAME_MS) as Timeframe[];

/** One closed candle. `time` is the bar's OPEN time, ms epoch, UTC. */
export interface Bar {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/** Price series an indicator or condition can read. */
export type Source = 'open' | 'high' | 'low' | 'close' | 'volume' | 'hl2' | 'hlc3' | 'ohlc4';

export const SOURCES: Source[] = ['open', 'high', 'low', 'close', 'volume', 'hl2', 'hlc3', 'ohlc4'];

export type IndicatorType =
    | 'SMA' | 'EMA' | 'RSI' | 'ATR'
    | 'MACD' | 'BBANDS' | 'STOCH'
    | 'HIGHEST' | 'LOWEST';

export interface IndicatorDef {
    type: IndicatorType;
    /** SMA/EMA/RSI/ATR/BBANDS/HIGHEST/LOWEST */
    period?: number;
    /** Defaults to 'close' where a source applies. ATR/STOCH read HLC directly. */
    source?: Source;
    /** MACD */
    fast?: number;
    slow?: number;
    signal?: number;
    /** BBANDS standard-deviation multiplier. */
    mult?: number;
    /** STOCH */
    kPeriod?: number;
    dPeriod?: number;
    /**
     * Optional higher timeframe. The indicator then updates on that
     * timeframe's bar closes, and conditions on the spec timeframe read its
     * value as of the last CLOSED higher-timeframe bar — never a forming one,
     * so there is no look-ahead.
     */
    timeframe?: Timeframe;
}

/** Fields each indicator type exposes to conditions. */
export const INDICATOR_FIELDS: Record<IndicatorType, string[]> = {
    SMA: ['value'],
    EMA: ['value'],
    RSI: ['value'],
    ATR: ['value'],
    HIGHEST: ['value'],
    LOWEST: ['value'],
    MACD: ['macd', 'signal', 'hist'],
    BBANDS: ['upper', 'middle', 'lower'],
    STOCH: ['k', 'd'],
};

/**
 * An operand is a number literal, a price source name, an indicator id, or
 * `id.field` for multi-output indicators (e.g. "macd.hist", "bb.upper").
 */
export type Operand = number | string;

export type Condition =
    | { gt: [Operand, Operand] }
    | { gte: [Operand, Operand] }
    | { lt: [Operand, Operand] }
    | { lte: [Operand, Operand] }
    /** True on the bar where a was <= b and is now > b. */
    | { crossesAbove: [Operand, Operand] }
    | { crossesBelow: [Operand, Operand] }
    /** True when the operand is strictly greater than its value N bars ago. */
    | { rising: [Operand, number] }
    | { falling: [Operand, number] }
    | { all: Condition[] }
    | { any: Condition[] }
    | { not: Condition };

/**
 * Trading sessions, defined in UTC and deliberately DST-blind: session
 * filters are a coarse regime gate, not an exchange calendar. Ranges are
 * half-open [from, to) on the bar's CLOSE hour and may wrap midnight.
 */
export type SessionName = 'sydney' | 'tokyo' | 'london' | 'newyork';

export const SESSION_HOURS_UTC: Record<SessionName, [number, number]> = {
    sydney: [21, 6],
    tokyo: [0, 9],
    london: [7, 16],
    newyork: [12, 21],
};

export type Filter =
    | { session: SessionName }
    /** Half-open [from, to) on the bar's close hour, UTC; may wrap midnight. */
    | { hoursUtc: [number, number] }
    /** UTC weekday of the bar close; 0 = Sunday … 6 = Saturday. */
    | { weekdaysUtc: number[] }
    /**
     * Skip entries when the live spread exceeds this. Applies where a spread
     * is known (live / forward test); a backtest may supply the instrument's
     * typical spread or leave it undefined, in which case the filter passes.
     */
    | { maxSpreadPips: number };

export type Distance = { pips: number } | { atrMultiple: number };
export type TakeProfitLevel = Distance | { rMultiple: number };

export interface ExitSpec {
    /**
     * Required. A strategy with no stop is not a strategy, and riskPercent
     * sizing is meaningless without a stop distance.
     */
    stopLoss: Distance;
    takeProfit?: TakeProfitLevel;
    trailingStop?: Distance;
    /** Close after this many bars in the position, whatever the price. */
    timeStop?: { bars: number };
    /** Signal exits: `long` closes a long position, `short` closes a short. */
    signal?: { long?: Condition; short?: Condition };
}

export type Sizing = { riskPercent: number } | { fixedLots: number };

export interface Limits {
    /** v1 interpreter holds at most one position per bot; kept for the engine. */
    maxOpenPositions?: number;
    maxTradesPerDay?: number;
    /** Bars to wait after an exit before the next entry. */
    cooldownBars?: number;
}

export interface StrategySpec {
    name: string;
    symbol: string;
    timeframe: Timeframe;
    indicators?: Record<string, IndicatorDef>;
    filters?: Filter[];
    entry: { long?: Condition; short?: Condition };
    exit: ExitSpec;
    sizing: Sizing;
    limits?: Limits;
}

// ═══════════════════════════════════════════════════════════════════
//  Runtime contracts
// ═══════════════════════════════════════════════════════════════════

/**
 * Per-bot counters the interpreter advances. Owned by the caller (bot runner
 * or backtester) so the interpreter itself stays a pure function of
 * (bars, state) — which is what makes backtest/live parity checkable.
 */
export interface BotState {
    /** UTC day key of the last processed bar, for the daily trade counter. */
    dayKey: string;
    tradesToday: number;
    /** Bars left before entries are allowed again after an exit. */
    cooldown: number;
    barsInPosition: number;
}

export const initialBotState = (): BotState => ({
    dayKey: '',
    tradesToday: 0,
    cooldown: 0,
    barsInPosition: 0,
});

export interface PositionView {
    side: 'BUY' | 'SELL';
}

/** Extra per-bar context the runtime knows and the spec cannot. */
export interface BarContext {
    spreadPips?: number;
    position?: PositionView | null;
}

export interface EntryDecision {
    side: 'BUY' | 'SELL';
    /** Absolute prices, already rounded to the instrument's digits. */
    stopLossPrice: number;
    takeProfitPrice: number | null;
    /** Trailing distance in price units, for the engine's trailing logic. */
    trailingDistance: number | null;
    sizing: Sizing;
    reason: string;
}

export interface ExitDecision {
    reason: 'SIGNAL' | 'TIME_STOP';
}

export interface Decision {
    enter?: EntryDecision;
    exit?: ExitDecision;
}
