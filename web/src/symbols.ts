/**
 * The instrument catalogue the terminal can search. Mirrors the server's
 * instrument table (backend/src/config/instruments.ts) — the server prices
 * anything it recognises, the client only needs names and grouping.
 */

export type AssetClass = 'Forex' | 'Metals' | 'Energy' | 'Indices' | 'Crypto' | 'Stocks';

export interface SymbolInfo {
    symbol: string;
    name: string;
    cls: AssetClass;
    /** Price decimals for display. */
    digits: number;
}

const fx = (s: string, name: string, digits = 5): SymbolInfo => ({ symbol: s, name, cls: 'Forex', digits });
const cr = (s: string, name: string, digits: number): SymbolInfo => ({ symbol: s, name, cls: 'Crypto', digits });
const ix = (s: string, name: string, digits = 1): SymbolInfo => ({ symbol: s, name, cls: 'Indices', digits });
const st = (s: string, name: string): SymbolInfo => ({ symbol: s, name, cls: 'Stocks', digits: 2 });

export const SYMBOLS: SymbolInfo[] = [
    fx('EUR/USD', 'Euro / US Dollar'), fx('GBP/USD', 'British Pound / US Dollar'), fx('USD/JPY', 'US Dollar / Japanese Yen', 3),
    fx('USD/CHF', 'US Dollar / Swiss Franc'), fx('USD/CAD', 'US Dollar / Canadian Dollar'), fx('AUD/USD', 'Australian Dollar / US Dollar'),
    fx('NZD/USD', 'New Zealand Dollar / US Dollar'), fx('EUR/GBP', 'Euro / British Pound'), fx('EUR/JPY', 'Euro / Japanese Yen', 3),
    fx('GBP/JPY', 'British Pound / Japanese Yen', 3), fx('EUR/AUD', 'Euro / Australian Dollar'), fx('EUR/CHF', 'Euro / Swiss Franc'),
    fx('GBP/AUD', 'British Pound / Australian Dollar'), fx('AUD/JPY', 'Australian Dollar / Japanese Yen', 3), fx('CAD/JPY', 'Canadian Dollar / Japanese Yen', 3),
    fx('CHF/JPY', 'Swiss Franc / Japanese Yen', 3), fx('AUD/NZD', 'Australian Dollar / New Zealand Dollar'), fx('AUD/CAD', 'Australian Dollar / Canadian Dollar'),
    fx('NZD/JPY', 'New Zealand Dollar / Japanese Yen', 3), fx('GBP/CAD', 'British Pound / Canadian Dollar'), fx('GBP/CHF', 'British Pound / Swiss Franc'),
    fx('USD/SGD', 'US Dollar / Singapore Dollar'), fx('USD/MXN', 'US Dollar / Mexican Peso', 4), fx('USD/ZAR', 'US Dollar / South African Rand', 4),
    fx('USD/TRY', 'US Dollar / Turkish Lira', 4),

    { symbol: 'GOLD', name: 'Gold Spot / US Dollar', cls: 'Metals', digits: 2 },
    { symbol: 'SILVER', name: 'Silver Spot / US Dollar', cls: 'Metals', digits: 3 },
    { symbol: 'PL=F', name: 'Platinum Futures', cls: 'Metals', digits: 2 },
    { symbol: 'PA=F', name: 'Palladium Futures', cls: 'Metals', digits: 2 },
    { symbol: 'HG=F', name: 'Copper Futures', cls: 'Metals', digits: 4 },
    { symbol: 'USOIL', name: 'WTI Crude Oil', cls: 'Energy', digits: 2 },
    { symbol: 'NG=F', name: 'Natural Gas Futures', cls: 'Energy', digits: 3 },

    ix('SPX', 'S&P 500 Index'), ix('NDQ', 'US 100 Index'), ix('DJI', 'Dow Jones Industrial Average'), ix('DAX', 'Germany 40 Index'),
    ix('FTSE', 'UK 100 Index'), ix('N225', 'Japan 225 Index'), ix('VIX', 'CBOE Volatility Index', 2), ix('DXY', 'US Dollar Index', 3),

    cr('BTC/USDT', 'Bitcoin / Tether', 1), cr('ETH/USDT', 'Ethereum / Tether', 2), cr('BNB/USDT', 'BNB / Tether', 2), cr('SOL/USDT', 'Solana / Tether', 3),
    cr('XRP/USDT', 'XRP / Tether', 5), cr('ADA/USDT', 'Cardano / Tether', 5), cr('DOGE/USDT', 'Dogecoin / Tether', 6), cr('AVAX/USDT', 'Avalanche / Tether', 3),
    cr('LINK/USDT', 'Chainlink / Tether', 3), cr('DOT/USDT', 'Polkadot / Tether', 4), cr('MATIC/USDT', 'Polygon / Tether', 5), cr('SHIB/USDT', 'Shiba Inu / Tether', 8),
    cr('LTC/USDT', 'Litecoin / Tether', 2), cr('TRX/USDT', 'TRON / Tether', 5), cr('UNI/USDT', 'Uniswap / Tether', 3), cr('TON/USDT', 'Toncoin / Tether', 3),
    cr('NOT/USDT', 'Notcoin / Tether', 6), cr('PEPE/USDT', 'Pepe / Tether', 8),

    st('AAPL', 'Apple Inc.'), st('MSFT', 'Microsoft Corp.'), st('NVDA', 'NVIDIA Corp.'), st('GOOGL', 'Alphabet Inc.'),
    st('AMZN', 'Amazon.com Inc.'), st('TSLA', 'Tesla Inc.'), st('META', 'Meta Platforms Inc.'), st('NFLX', 'Netflix Inc.'), st('INTC', 'Intel Corp.'),
];

export const CLASSES: AssetClass[] = ['Forex', 'Metals', 'Energy', 'Indices', 'Crypto', 'Stocks'];

const BY_SYMBOL = new Map(SYMBOLS.map(s => [s.symbol, s]));

export function infoOf(symbol: string): SymbolInfo {
    return BY_SYMBOL.get(symbol) ?? { symbol, name: symbol, cls: symbol.includes('/USDT') ? 'Crypto' : 'Stocks', digits: 2 };
}

/** Number of decimals a price should be shown with, inferred if unknown. */
export function digitsFor(symbol: string, price?: number | null): number {
    const known = BY_SYMBOL.get(symbol);
    if (known) return known.digits;
    if (price == null) return 2;
    if (price >= 1000) return 1;
    if (price >= 10) return 2;
    if (price >= 1) return 4;
    return 6;
}

export function fmtPrice(symbol: string, price: number | null | undefined): string {
    if (price == null || !Number.isFinite(price)) return '—';
    return price.toFixed(digitsFor(symbol, price));
}

export function search(query: string, cls?: AssetClass | 'All'): SymbolInfo[] {
    const needle = query.trim().toUpperCase().replace(/\s+/g, '');
    return SYMBOLS.filter(s => {
        if (cls && cls !== 'All' && s.cls !== cls) return false;
        if (!needle) return true;
        return s.symbol.replace('/', '').includes(needle) || s.name.toUpperCase().replace(/\s+/g, '').includes(needle);
    });
}

/** The candidate list at sign-up until the user edits it. */
export const DEFAULT_WATCHLIST = ['BTC/USDT', 'ETH/USDT', 'GOLD', 'EUR/USD', 'GBP/USD', 'SPX', 'NDQ', 'AAPL'];

/** A/B flag badge text: two letters for pairs, first letters otherwise. */
export function badgeOf(symbol: string): string {
    if (symbol.includes('/')) return symbol.split('/')[0].slice(0, 3);
    return symbol.slice(0, 3);
}

/** Units per 1.00 lot, mirroring the server's instrument table closely enough for on-chart estimates. */
export function contractSizeOf(symbol: string): number {
    const info = infoOf(symbol);
    if (info.cls === 'Forex') return 100_000;
    if (symbol === 'GOLD') return 100;
    if (symbol === 'SILVER') return 5000;
    if (symbol === 'USOIL') return 1000;
    if (symbol === 'NG=F') return 10_000;
    if (symbol === 'HG=F') return 25_000;
    if (symbol === 'PL=F' || symbol === 'PA=F') return 100;
    return 1;
}
