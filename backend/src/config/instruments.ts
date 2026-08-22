/**
 * INSTRUMENT SPECIFICATIONS — single source of truth.
 *
 * Every margin, pip-value and P/L calculation in the engine reads from here.
 * Before this module the numbers were duplicated across tradeController.ts and
 * four places in the mobile client, and forex pairs were missing from all of
 * them — a 1.00 lot EUR/USD position was sized as 1 unit instead of 100,000,
 * making forex margin and P/L 100,000x too small.
 *
 * The specs below are the standard FX/CFD contract values used by retail
 * brokers (IC Markets / Pepperstone class). When a live broker feed is
 * connected they should be overridden with the broker's own values —
 * cTrader Open API's ProtoOASymbolByIdReq returns lotSize, digits, pip
 * position, volume limits, commission and swap rates, which map onto this
 * shape. `applyBrokerSpec()` exists for that.
 */

export type AssetClass = 'FOREX' | 'METAL' | 'ENERGY' | 'INDEX' | 'CRYPTO' | 'STOCK';

export interface InstrumentSpec {
    symbol: string;
    assetClass: AssetClass;
    /** Currency the contract is denominated in (the "base" of BASE/QUOTE). */
    base: string;
    /** Currency the price is quoted in — P/L accrues in this currency. */
    quote: string;
    /** Units of `base` per 1.00 lot. Forex = 100_000, GOLD = 100 oz, etc. */
    contractSize: number;
    /** Price decimal places used for rounding/display. */
    digits: number;
    /** Price increment of one pip (NOT one point). EUR/USD 0.0001, USD/JPY 0.01. */
    pipSize: number;
    /** Fraction of notional required as margin. 0.005 = 1:200. */
    marginRate: number;
    /** Round-turn commission per lot, in account currency. */
    commissionPerLot: number;
    /** Typical spread in *pips*, used only when a feed gives no ask. */
    typicalSpreadPips: number;
    /** Annualised financing rate applied to a long position, as a fraction. */
    swapLongRate: number;
    /** Annualised financing rate applied to a short position, as a fraction. */
    swapShortRate: number;
    minVolume: number;
    maxVolume: number;
    volumeStep: number;
}

/** Leverage helpers — retail-broker typical values per asset class. */
const R = {
    FOREX_MAJOR: 1 / 200,
    FOREX_MINOR: 1 / 100,
    METAL: 1 / 200,
    ENERGY: 1 / 100,
    INDEX: 1 / 200,
    CRYPTO: 1 / 10,
    STOCK: 1 / 20,
};

/** Shared defaults so each entry only states what actually differs. */
const forex = (
    symbol: string,
    base: string,
    quote: string,
    opts: Partial<InstrumentSpec> = {}
): InstrumentSpec => {
    const jpy = quote === 'JPY';
    return {
        symbol,
        assetClass: 'FOREX',
        base,
        quote,
        contractSize: 100_000,
        digits: jpy ? 3 : 5,
        pipSize: jpy ? 0.01 : 0.0001,
        marginRate: R.FOREX_MAJOR,
        commissionPerLot: 7,
        typicalSpreadPips: 0.2,
        swapLongRate: -0.015,
        swapShortRate: -0.005,
        minVolume: 0.01,
        maxVolume: 100,
        volumeStep: 0.01,
        ...opts,
    };
};

const crypto = (symbol: string, base: string, digits: number, spread: number): InstrumentSpec => ({
    symbol,
    assetClass: 'CRYPTO',
    base,
    quote: 'USD',
    contractSize: 1,
    digits,
    pipSize: Math.pow(10, -digits),
    marginRate: R.CRYPTO,
    commissionPerLot: 0,
    typicalSpreadPips: spread,
    // Crypto CFDs are financed both ways.
    swapLongRate: -0.20,
    swapShortRate: -0.20,
    minVolume: 0.01,
    maxVolume: 50,
    volumeStep: 0.01,
});

const index = (symbol: string, digits = 1): InstrumentSpec => ({
    symbol,
    assetClass: 'INDEX',
    base: 'USD',
    quote: 'USD',
    contractSize: 1,
    digits,
    pipSize: Math.pow(10, -digits),
    marginRate: R.INDEX,
    commissionPerLot: 0,
    typicalSpreadPips: 4,
    swapLongRate: -0.05,
    swapShortRate: -0.02,
    minVolume: 0.1,
    maxVolume: 200,
    volumeStep: 0.1,
});

const stock = (symbol: string): InstrumentSpec => ({
    symbol,
    assetClass: 'STOCK',
    base: 'USD',
    quote: 'USD',
    contractSize: 1,
    digits: 2,
    pipSize: 0.01,
    marginRate: R.STOCK,
    commissionPerLot: 0.02,
    typicalSpreadPips: 2,
    swapLongRate: -0.06,
    swapShortRate: -0.03,
    minVolume: 1,
    maxVolume: 10_000,
    volumeStep: 1,
});

const SPECS: Record<string, InstrumentSpec> = {
    // ─── FOREX MAJORS ───────────────────────────────────────────────
    'EUR/USD': forex('EUR/USD', 'EUR', 'USD', { typicalSpreadPips: 0.1 }),
    'GBP/USD': forex('GBP/USD', 'GBP', 'USD', { typicalSpreadPips: 0.3 }),
    'USD/JPY': forex('USD/JPY', 'USD', 'JPY', { typicalSpreadPips: 0.2 }),
    'USD/CHF': forex('USD/CHF', 'USD', 'CHF', { typicalSpreadPips: 0.4 }),
    'USD/CAD': forex('USD/CAD', 'USD', 'CAD', { typicalSpreadPips: 0.4 }),
    'AUD/USD': forex('AUD/USD', 'AUD', 'USD', { typicalSpreadPips: 0.3 }),
    'NZD/USD': forex('NZD/USD', 'NZD', 'USD', { typicalSpreadPips: 0.5 }),

    // ─── FOREX CROSSES ──────────────────────────────────────────────
    'EUR/GBP': forex('EUR/GBP', 'EUR', 'GBP', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 0.6 }),
    'EUR/JPY': forex('EUR/JPY', 'EUR', 'JPY', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 0.6 }),
    'GBP/JPY': forex('GBP/JPY', 'GBP', 'JPY', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 1.0 }),
    'EUR/AUD': forex('EUR/AUD', 'EUR', 'AUD', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 1.0 }),
    'EUR/CHF': forex('EUR/CHF', 'EUR', 'CHF', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 0.8 }),
    'GBP/AUD': forex('GBP/AUD', 'GBP', 'AUD', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 1.4 }),
    'AUD/JPY': forex('AUD/JPY', 'AUD', 'JPY', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 0.8 }),
    'CAD/JPY': forex('CAD/JPY', 'CAD', 'JPY', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 1.0 }),
    'CHF/JPY': forex('CHF/JPY', 'CHF', 'JPY', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 1.2 }),
    'AUD/NZD': forex('AUD/NZD', 'AUD', 'NZD', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 1.2 }),
    'AUD/CAD': forex('AUD/CAD', 'AUD', 'CAD', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 1.2 }),
    'NZD/JPY': forex('NZD/JPY', 'NZD', 'JPY', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 1.4 }),
    'GBP/CAD': forex('GBP/CAD', 'GBP', 'CAD', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 1.6 }),
    'GBP/CHF': forex('GBP/CHF', 'GBP', 'CHF', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 1.6 }),
    'USD/SGD': forex('USD/SGD', 'USD', 'SGD', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 1.2 }),
    'USD/MXN': forex('USD/MXN', 'USD', 'MXN', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 15 }),
    'USD/ZAR': forex('USD/ZAR', 'USD', 'ZAR', { marginRate: R.FOREX_MINOR, typicalSpreadPips: 25 }),
    'USD/TRY': forex('USD/TRY', 'USD', 'TRY', { marginRate: 1 / 50, typicalSpreadPips: 30 }),

    // ─── METALS ────────────────────────────────────────────────────
    // GOLD is XAU/USD: 100 troy oz per lot, pip = $0.01 → $1/pip per lot.
    GOLD: {
        symbol: 'GOLD', assetClass: 'METAL', base: 'XAU', quote: 'USD',
        contractSize: 100, digits: 2, pipSize: 0.01, marginRate: R.METAL,
        commissionPerLot: 7, typicalSpreadPips: 20,
        swapLongRate: -0.04, swapShortRate: -0.02,
        minVolume: 0.01, maxVolume: 50, volumeStep: 0.01,
    },
    // SILVER is XAG/USD: 5,000 troy oz per lot.
    SILVER: {
        symbol: 'SILVER', assetClass: 'METAL', base: 'XAG', quote: 'USD',
        contractSize: 5_000, digits: 3, pipSize: 0.001, marginRate: R.METAL,
        commissionPerLot: 7, typicalSpreadPips: 20,
        swapLongRate: -0.04, swapShortRate: -0.02,
        minVolume: 0.01, maxVolume: 50, volumeStep: 0.01,
    },
    'PL=F': {
        symbol: 'PL=F', assetClass: 'METAL', base: 'XPT', quote: 'USD',
        contractSize: 100, digits: 2, pipSize: 0.01, marginRate: R.METAL,
        commissionPerLot: 7, typicalSpreadPips: 50,
        swapLongRate: -0.05, swapShortRate: -0.03,
        minVolume: 0.01, maxVolume: 20, volumeStep: 0.01,
    },
    'PA=F': {
        symbol: 'PA=F', assetClass: 'METAL', base: 'XPD', quote: 'USD',
        contractSize: 100, digits: 2, pipSize: 0.01, marginRate: R.METAL,
        commissionPerLot: 7, typicalSpreadPips: 80,
        swapLongRate: -0.05, swapShortRate: -0.03,
        minVolume: 0.01, maxVolume: 20, volumeStep: 0.01,
    },
    'HG=F': {
        symbol: 'HG=F', assetClass: 'METAL', base: 'XCU', quote: 'USD',
        contractSize: 25_000, digits: 4, pipSize: 0.0001, marginRate: R.ENERGY,
        commissionPerLot: 7, typicalSpreadPips: 20,
        swapLongRate: -0.05, swapShortRate: -0.03,
        minVolume: 0.01, maxVolume: 20, volumeStep: 0.01,
    },

    // ─── ENERGY ────────────────────────────────────────────────────
    // 1,000 barrels per lot, pip = $0.01 → $10/pip per lot.
    USOIL: {
        symbol: 'USOIL', assetClass: 'ENERGY', base: 'WTI', quote: 'USD',
        contractSize: 1_000, digits: 2, pipSize: 0.01, marginRate: R.ENERGY,
        commissionPerLot: 7, typicalSpreadPips: 3,
        swapLongRate: -0.08, swapShortRate: -0.05,
        minVolume: 0.01, maxVolume: 50, volumeStep: 0.01,
    },
    'NG=F': {
        symbol: 'NG=F', assetClass: 'ENERGY', base: 'NGAS', quote: 'USD',
        contractSize: 10_000, digits: 3, pipSize: 0.001, marginRate: R.ENERGY,
        commissionPerLot: 7, typicalSpreadPips: 3,
        swapLongRate: -0.10, swapShortRate: -0.07,
        minVolume: 0.01, maxVolume: 50, volumeStep: 0.01,
    },

    // ─── INDICES ───────────────────────────────────────────────────
    SPX: index('SPX', 1),
    NDQ: index('NDQ', 1),
    DJI: index('DJI', 1),
    DAX: index('DAX', 1),
    FTSE: index('FTSE', 1),
    N225: index('N225', 0),
    VIX: { ...index('VIX', 2), typicalSpreadPips: 10 },
    DXY: { ...index('DXY', 3), typicalSpreadPips: 3 },

    // ─── CRYPTO ────────────────────────────────────────────────────
    'BTC/USDT': crypto('BTC/USDT', 'BTC', 1, 100),
    'ETH/USDT': crypto('ETH/USDT', 'ETH', 2, 50),
    'BNB/USDT': crypto('BNB/USDT', 'BNB', 2, 30),
    'SOL/USDT': crypto('SOL/USDT', 'SOL', 3, 20),
    'XRP/USDT': crypto('XRP/USDT', 'XRP', 5, 20),
    'ADA/USDT': crypto('ADA/USDT', 'ADA', 5, 20),
    'DOGE/USDT': crypto('DOGE/USDT', 'DOGE', 6, 20),
    'AVAX/USDT': crypto('AVAX/USDT', 'AVAX', 3, 20),
    'LINK/USDT': crypto('LINK/USDT', 'LINK', 3, 20),
    'DOT/USDT': crypto('DOT/USDT', 'DOT', 4, 20),
    'MATIC/USDT': crypto('MATIC/USDT', 'MATIC', 5, 20),
    'SHIB/USDT': crypto('SHIB/USDT', 'SHIB', 8, 20),
    'LTC/USDT': crypto('LTC/USDT', 'LTC', 2, 30),
    'TRX/USDT': crypto('TRX/USDT', 'TRX', 5, 20),
    'UNI/USDT': crypto('UNI/USDT', 'UNI', 3, 20),
    'TON/USDT': crypto('TON/USDT', 'TON', 3, 20),
    'NOT/USDT': crypto('NOT/USDT', 'NOT', 6, 20),
    'PEPE/USDT': crypto('PEPE/USDT', 'PEPE', 8, 20),

    // ─── STOCKS ────────────────────────────────────────────────────
    AAPL: stock('AAPL'), MSFT: stock('MSFT'), NVDA: stock('NVDA'),
    GOOGL: stock('GOOGL'), AMZN: stock('AMZN'), TSLA: stock('TSLA'),
    NFLX: stock('NFLX'), META: stock('META'), AMD: stock('AMD'),
    INTC: stock('INTC'), COIN: stock('COIN'), BABA: stock('BABA'),
};

/**
 * Infer a spec for a symbol that has no explicit entry, so an unknown symbol
 * degrades to something sane instead of silently falling back to
 * contractSize = 1 (the bug this module exists to kill).
 */
function inferSpec(symbol: string): InstrumentSpec {
    const upper = symbol.toUpperCase();

    // Crypto quoted against USDT/USD/BTC
    if (/\/(USDT|USD|BTC)$/.test(upper) && /^(BTC|ETH|BNB|SOL|XRP|ADA|DOGE|AVAX|LINK|DOT|MATIC|SHIB|LTC|TRX|UNI|TON|NOT|PEPE|[A-Z]{2,6})\//.test(upper)) {
        const base = upper.split('/')[0];
        // A 6-decimal default keeps sub-cent coins from rounding to zero.
        if (/^(BTC|ETH|BNB|SOL|LTC)$/.test(base)) return crypto(symbol, base, 2, 50);
        return crypto(symbol, base, 6, 20);
    }

    // Any remaining BASE/QUOTE with 3-letter legs is treated as forex.
    const fx = upper.match(/^([A-Z]{3})\/([A-Z]{3})$/);
    if (fx) {
        console.warn(`[Instruments] No spec for forex pair ${symbol} — inferring standard 100k contract.`);
        return forex(symbol, fx[1], fx[2], { marginRate: R.FOREX_MINOR, typicalSpreadPips: 2 });
    }

    console.warn(`[Instruments] No spec for ${symbol} — defaulting to single-unit CFD.`);
    return stock(symbol);
}

const inferred = new Map<string, InstrumentSpec>();

/** Look up an instrument spec. Never returns undefined. */
export function getSpec(symbol: string): InstrumentSpec {
    const direct = SPECS[symbol] || SPECS[symbol.toUpperCase()];
    if (direct) return direct;

    const cached = inferred.get(symbol);
    if (cached) return cached;

    const spec = inferSpec(symbol);
    inferred.set(symbol, spec);
    return spec;
}

export function hasSpec(symbol: string): boolean {
    return !!(SPECS[symbol] || SPECS[symbol.toUpperCase()]);
}

export function allSymbols(): string[] {
    return Object.keys(SPECS);
}

/**
 * Overlay broker-supplied contract details onto a spec. Call this when a live
 * broker feed (e.g. cTrader ProtoOASymbolByIdReq) reports the authoritative
 * values, so the engine trades on the broker's terms rather than our defaults.
 */
export function applyBrokerSpec(symbol: string, patch: Partial<InstrumentSpec>): InstrumentSpec {
    const current = getSpec(symbol);
    const merged: InstrumentSpec = { ...current, ...patch, symbol: current.symbol };
    SPECS[current.symbol] = merged;
    inferred.delete(symbol);
    return merged;
}

/** Round a price to the instrument's quoted precision. */
export function roundPrice(symbol: string, price: number): number {
    const { digits } = getSpec(symbol);
    const f = Math.pow(10, digits);
    return Math.round(price * f) / f;
}

/** Snap a requested volume onto the instrument's lot grid. */
export function normaliseVolume(symbol: string, volume: number): number {
    const { minVolume, maxVolume, volumeStep } = getSpec(symbol);
    const stepped = Math.round(volume / volumeStep) * volumeStep;
    const clamped = Math.min(Math.max(stepped, minVolume), maxVolume);
    // volumeStep can be fractional, so re-round to kill float noise.
    const decimals = (String(volumeStep).split('.')[1] || '').length;
    return Number(clamped.toFixed(decimals));
}
