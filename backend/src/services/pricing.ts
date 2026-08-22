/**
 * PRICING & ACCOUNTING ENGINE
 *
 * All money maths for the trading engine lives here: bid/ask quotes, currency
 * conversion, pip value, margin, and P/L.
 *
 * Two things the previous implementation was missing entirely:
 *
 *  1. Currency conversion. P/L accrues in an instrument's QUOTE currency and
 *     margin is charged on its BASE currency notional; both must be converted
 *     into the account currency. Without it, every JPY pair and every cross
 *     was wrong even once contract sizes were right — a 1.00 lot USD/JPY
 *     position that moves 50 pips earns 50,000 JPY, which is $314 and not
 *     $50,000.
 *
 *  2. Bid/ask. A broker fills a buy at the ask and a sell at the bid, and
 *     values an open long against the bid (the price it would close at).
 *     The old engine had a single mid price, so the spread was never really
 *     charged and stop losses triggered on the wrong side of the book.
 */

import { getSpec, roundPrice, InstrumentSpec } from '../config/instruments';

export const ACCOUNT_CURRENCY = 'USD';

export interface Quote {
    symbol: string;
    bid: number;
    ask: number;
    /** ms epoch of the last update. */
    ts: number;
}

// ═══════════════════════════════════════════════════════════════════
//  QUOTE STORE
// ═══════════════════════════════════════════════════════════════════

const quotes = new Map<string, Quote>();

/**
 * Record a two-sided quote. Prefer this — a real feed (cTrader spot events,
 * MT5 symbol_info_tick) always gives both sides.
 */
export function setQuote(symbol: string, bid: number, ask: number, ts = Date.now()): Quote {
    if (!(bid > 0) || !(ask > 0)) {
        throw new Error(`setQuote(${symbol}): bid and ask must be positive, got ${bid}/${ask}`);
    }
    // Guard against an inverted book from a bad feed frame.
    const q: Quote = {
        symbol,
        bid: roundPrice(symbol, Math.min(bid, ask)),
        ask: roundPrice(symbol, Math.max(bid, ask)),
        ts,
    };
    quotes.set(symbol, q);
    return q;
}

/**
 * Record a single mid price, synthesising a two-sided quote from the
 * instrument's typical spread. Only for feeds that publish one price
 * (Yahoo, Binance ticker) — a real broker feed should use setQuote.
 */
export function setMidPrice(symbol: string, mid: number, ts = Date.now()): Quote {
    if (!(mid > 0)) throw new Error(`setMidPrice(${symbol}): price must be positive, got ${mid}`);
    const spec = getSpec(symbol);
    const halfSpread = (spec.typicalSpreadPips * spec.pipSize) / 2;
    // Round the bid down and the ask up onto the tick grid. Half of a
    // sub-tick spread (EUR/USD's 0.1 pip is half a tick) would otherwise
    // round inward and quote tighter than the instrument's real minimum —
    // a broker never does that, and it would hand traders free edge.
    const tick = Math.pow(10, -spec.digits);
    const bid = Math.floor((mid - halfSpread) / tick) * tick;
    const ask = Math.ceil((mid + halfSpread) / tick) * tick;
    return setQuote(symbol, bid, ask, ts);
}

export function getQuote(symbol: string): Quote | undefined {
    return quotes.get(symbol);
}

/**
 * Mid price, or undefined when the symbol has never been quoted.
 * Rounded to the instrument's precision so float noise from averaging the two
 * sides never reaches a client or a saved cache file.
 */
export function getMid(symbol: string): number | undefined {
    const q = quotes.get(symbol);
    return q ? roundPrice(symbol, (q.bid + q.ask) / 2) : undefined;
}

/** Snapshot of every known mid price — for the /market/prices response. */
export function getAllMids(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const symbol of quotes.keys()) out[symbol] = getMid(symbol)!;
    return out;
}

export function getAllQuotes(): Quote[] {
    return Array.from(quotes.values());
}

/** Spread in pips, as a trader would read it off the platform. */
export function getSpreadPips(symbol: string): number | undefined {
    const q = quotes.get(symbol);
    if (!q) return undefined;
    return (q.ask - q.bid) / getSpec(symbol).pipSize;
}

// ═══════════════════════════════════════════════════════════════════
//  EXECUTION SIDES
//
//  A long is opened at the ask and closed at the bid; a short is opened at
//  the bid and closed at the ask. That asymmetry *is* the spread cost, and
//  it must be applied on both legs — charging it only at entry (as the old
//  code did) understates trading costs by half.
// ═══════════════════════════════════════════════════════════════════

export type Side = 'BUY' | 'SELL';

/** Price at which a new position of `side` fills. */
export function openPrice(symbol: string, side: Side): number | undefined {
    const q = quotes.get(symbol);
    if (!q) return undefined;
    return side === 'BUY' ? q.ask : q.bid;
}

/** Price at which an existing position of `side` would close right now. */
export function closePrice(symbol: string, side: Side): number | undefined {
    const q = quotes.get(symbol);
    if (!q) return undefined;
    return side === 'BUY' ? q.bid : q.ask;
}

// ═══════════════════════════════════════════════════════════════════
//  CURRENCY CONVERSION
// ═══════════════════════════════════════════════════════════════════

/** Currencies whose rate we can read straight off a quoted instrument. */
const METAL_PROXY: Record<string, string> = {
    XAU: 'GOLD', XAG: 'SILVER', XPT: 'PL=F', XPD: 'PA=F', XCU: 'HG=F',
    WTI: 'USOIL', NGAS: 'NG=F',
};

/**
 * Rate to convert 1 unit of `ccy` into the account currency.
 *
 * Resolution order: identity → a directly quoted pair (CCY/USD) → the
 * inverse pair (USD/CCY) → a crypto or commodity proxy instrument → a cross
 * via USD. Returns undefined rather than guessing when nothing is quoted, so
 * callers can refuse the trade instead of booking a wrong number.
 */
export function rateToAccount(ccy: string, accountCcy = ACCOUNT_CURRENCY): number | undefined {
    if (ccy === accountCcy) return 1;

    // USDT is treated as a dollar stand-in — crypto pairs quote against it.
    if (ccy === 'USDT' && accountCcy === 'USD') return 1;

    const direct = getMid(`${ccy}/${accountCcy}`);
    if (direct) return direct;

    const inverse = getMid(`${accountCcy}/${ccy}`);
    if (inverse) return 1 / inverse;

    // Metals and energy: the instrument price *is* the rate per unit.
    const proxy = METAL_PROXY[ccy];
    if (proxy) {
        const p = getMid(proxy);
        if (p) return p;
    }

    // Crypto base currencies quote against USDT.
    const cryptoMid = getMid(`${ccy}/USDT`);
    if (cryptoMid) return cryptoMid;

    // Last resort: cross through USD (e.g. NZD -> USD -> EUR account).
    if (accountCcy !== 'USD') {
        const ccyUsd = rateToAccount(ccy, 'USD');
        const acctUsd = rateToAccount(accountCcy, 'USD');
        if (ccyUsd && acctUsd) return ccyUsd / acctUsd;
    }

    return undefined;
}

/**
 * Convert an amount denominated in `ccy` into the account currency.
 * Throws when no rate is available — silently returning the unconverted
 * amount is how wrong balances get written to the database.
 */
export function toAccountCurrency(amount: number, ccy: string, accountCcy = ACCOUNT_CURRENCY): number {
    const rate = rateToAccount(ccy, accountCcy);
    if (rate === undefined) {
        throw new Error(`No ${ccy}->${accountCcy} rate available; cannot convert ${amount}`);
    }
    return amount * rate;
}

/** Same as toAccountCurrency but yields undefined instead of throwing. */
export function tryToAccountCurrency(amount: number, ccy: string, accountCcy = ACCOUNT_CURRENCY): number | undefined {
    const rate = rateToAccount(ccy, accountCcy);
    return rate === undefined ? undefined : amount * rate;
}

// ═══════════════════════════════════════════════════════════════════
//  CONTRACT MATHS
// ═══════════════════════════════════════════════════════════════════

/** Notional value of a position, in the instrument's base currency units. */
export function notionalInBase(spec: InstrumentSpec, volume: number): number {
    return volume * spec.contractSize;
}

/**
 * Margin required to hold `volume` lots, in the account currency.
 *
 *   margin = volume x contractSize x rate(base -> account) x marginRate
 *
 * Note the rate is on the BASE currency, not the price. For EUR/USD the two
 * coincide (base EUR, quoted in USD), which is why the old
 * `volume * contractSize * price / leverage` looked right for majors — but
 * for USD/JPY the base is USD, so margin is 100,000/200 = $500 regardless of
 * where USD/JPY trades. The old formula returned $0.79.
 */
export function marginRequired(symbol: string, volume: number, accountCcy = ACCOUNT_CURRENCY): number | undefined {
    const spec = getSpec(symbol);
    const rate = rateToAccount(spec.base, accountCcy);
    if (rate === undefined) return undefined;
    return notionalInBase(spec, volume) * rate * spec.marginRate;
}

/**
 * Value of one pip for `volume` lots, in the account currency.
 * EUR/USD 1.00 lot => $10.00; USD/JPY 1.00 lot => ~$6.29.
 */
export function pipValue(symbol: string, volume: number, accountCcy = ACCOUNT_CURRENCY): number | undefined {
    const spec = getSpec(symbol);
    const inQuote = spec.pipSize * notionalInBase(spec, volume);
    return tryToAccountCurrency(inQuote, spec.quote, accountCcy);
}

/**
 * Gross P/L of a price move, in the account currency, before costs.
 * `exit` and `entry` must already be the correct sides of the book.
 */
export function grossPnL(
    symbol: string,
    side: Side,
    volume: number,
    entry: number,
    exit: number,
    accountCcy = ACCOUNT_CURRENCY
): number | undefined {
    const spec = getSpec(symbol);
    const move = side === 'BUY' ? exit - entry : entry - exit;
    const inQuote = move * notionalInBase(spec, volume);
    return tryToAccountCurrency(inQuote, spec.quote, accountCcy);
}

export interface PositionLike {
    symbol: string;
    side: Side;
    volume: number;
    entryPrice: number;
    commission?: number;
    swap?: number;
    closePrice?: number | null;
}

/**
 * Floating P/L of an open position, net of commission and accrued swap,
 * valued at the price it would actually close at.
 * Returns undefined when the symbol is unquoted — callers must not treat
 * that as zero.
 */
export function unrealizedPnL(pos: PositionLike, accountCcy = ACCOUNT_CURRENCY): number | undefined {
    const exit = pos.closePrice ?? closePrice(pos.symbol, pos.side);
    if (exit === undefined) return undefined;
    const gross = grossPnL(pos.symbol, pos.side, pos.volume, pos.entryPrice, exit, accountCcy);
    if (gross === undefined) return undefined;
    return gross - (pos.commission || 0) + (pos.swap || 0);
}

/** Realised P/L for a position closing at a known price. */
export function realizedPnL(pos: PositionLike, exit: number, accountCcy = ACCOUNT_CURRENCY): number | undefined {
    const gross = grossPnL(pos.symbol, pos.side, pos.volume, pos.entryPrice, exit, accountCcy);
    if (gross === undefined) return undefined;
    return gross - (pos.commission || 0) + (pos.swap || 0);
}

/** Round-turn commission for a volume, in the account currency. */
export function commissionFor(symbol: string, volume: number): number {
    return getSpec(symbol).commissionPerLot * volume;
}

// ═══════════════════════════════════════════════════════════════════
//  SWAP / OVERNIGHT FINANCING
//
//  Brokers charge or pay financing when a position is held past the daily
//  rollover, and book three days' worth on Wednesday to cover the weekend.
//  The old engine had a `swap` column in the database that nothing ever
//  wrote to, so holding a position was free.
// ═══════════════════════════════════════════════════════════════════

/** Rollover multiplier: 3x on Wednesday (weekend value date), else 1x. */
export function swapMultiplier(date = new Date()): number {
    return date.getUTCDay() === 3 ? 3 : 1;
}

/**
 * One night's financing for a position, in the account currency.
 * Negative = charged to the client.
 */
export function nightlySwap(
    pos: Pick<PositionLike, 'symbol' | 'side' | 'volume'>,
    date = new Date(),
    accountCcy = ACCOUNT_CURRENCY
): number | undefined {
    const spec = getSpec(pos.symbol);
    const rate = pos.side === 'BUY' ? spec.swapLongRate : spec.swapShortRate;
    const baseRate = rateToAccount(spec.base, accountCcy);
    if (baseRate === undefined) return undefined;
    const notional = notionalInBase(spec, pos.volume) * baseRate;
    return (notional * rate / 365) * swapMultiplier(date);
}

// ═══════════════════════════════════════════════════════════════════
//  ACCOUNT METRICS
// ═══════════════════════════════════════════════════════════════════

/** Margin call at 100%, stop-out at 50% — IC Markets / Pepperstone standard. */
export const MARGIN_CALL_LEVEL = 100;
export const STOP_OUT_LEVEL = 50;

export interface AccountMetrics {
    balance: number;
    equity: number;
    margin: number;
    freeMargin: number;
    marginLevel: number;
    floatingPnL: number;
    /** Symbols that could not be valued — their positions are excluded. */
    unpriced: string[];
}

/**
 * Derive account metrics from a balance and a set of open positions.
 * Pure function so it can be unit-tested without a database.
 */
export function accountMetrics(
    balance: number,
    positions: PositionLike[],
    accountCcy = ACCOUNT_CURRENCY
): AccountMetrics {
    let floatingPnL = 0;
    let margin = 0;
    const unpriced: string[] = [];

    for (const pos of positions) {
        const pnl = unrealizedPnL(pos, accountCcy);
        const m = marginRequired(pos.symbol, pos.volume, accountCcy);
        if (pnl === undefined || m === undefined) {
            unpriced.push(pos.symbol);
            continue;
        }
        floatingPnL += pnl;
        margin += m;
    }

    const equity = balance + floatingPnL;
    return {
        balance,
        equity,
        margin,
        freeMargin: equity - margin,
        // No open margin means no margin level to breach; a large sentinel
        // keeps stop-out comparisons from firing on a flat account.
        marginLevel: margin > 0 ? (equity / margin) * 100 : Number.POSITIVE_INFINITY,
        floatingPnL,
        unpriced,
    };
}

/** Testing seam — drop all cached quotes. */
export function __resetQuotes() {
    quotes.clear();
}
