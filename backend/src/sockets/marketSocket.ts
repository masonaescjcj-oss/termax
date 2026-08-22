import { Server } from 'socket.io';
import axios from 'axios';
import YahooFinance from 'yahoo-finance2';
import { processTrailingStops, processTPSL, processStopOuts, runGlobalStopOutCheck, processPendingOrders, accrueOvernightSwap } from '../controllers/tradeController';
import fs from 'fs';
import path from 'path';
import { setMidPrice, setQuote, getMid, getQuote, getAllMids, getSpreadPips } from '../services/pricing';
import { roundPrice } from '../config/instruments';

const yahooFinance = new YahooFinance();
const BINANCE_API_URL = 'https://api.binance.com/api/v3';

// Helper to check if symbol is crypto
const isCrypto = (symbol: string) =>
    symbol.endsWith('/USDT') || symbol.endsWith('USDT') || symbol.endsWith('/BTC') || symbol.endsWith('BTC');

// Map our symbol names to Yahoo Finance tickers
const yahooSymbolMap: Record<string, string> = {
    'GOLD': 'GC=F',
    'SILVER': 'SI=F',
    'SPX': '^GSPC',
    'NDQ': '^NDX',
    'DJI': '^DJI',
    'VIX': '^VIX',
    'DXY': 'DX=F',
    'USOIL': 'CL=F',
    'AAPL': 'AAPL',
    'TSLA': 'TSLA',
    'MSFT': 'MSFT',
    'NVDA': 'NVDA',
    'GOOGL': 'GOOGL',
    'AMZN': 'AMZN',
    'NFLX': 'NFLX',
    'DAX': '^GDAXI',
    'FTSE': '^FTSE',
    'N225': '^N225',
};

const getYahooTicker = (symbol: string) => {
    if (yahooSymbolMap[symbol]) return yahooSymbolMap[symbol];
    if (symbol.includes('/USDT')) return symbol.replace('/USDT', '-USD');
    if (symbol.includes('/BTC')) return symbol.replace('/BTC', '-BTC');
    if (symbol.includes('/')) return symbol.replace('/', '') + '=X';
    return symbol;
};

// Fallback seed prices in case of closed market or API connection failures
const FALLBACK_PRICES: Record<string, number> = {
    // Metals
    'GOLD': 2350.0,
    'SILVER': 29.50,
    'USOIL': 80.0,
    'HG=F': 4.50,
    'PL=F': 980.0,
    'PA=F': 950.0,
    'NG=F': 2.50,
    // Crypto
    'BTC/USDT': 63500.0,
    'ETH/USDT': 3450.0,
    'SOL/USDT': 142.0,
    'BNB/USDT': 585.0,
    'XRP/USDT': 0.485,
    'ADA/USDT': 0.38,
    'DOGE/USDT': 0.125,
    'AVAX/USDT': 28.5,
    'LINK/USDT': 14.2,
    'DOT/USDT': 5.85,
    'MATIC/USDT': 0.565,
    'SHIB/USDT': 0.000018,
    'LTC/USDT': 75.5,
    'TRX/USDT': 0.115,
    'UNI/USDT': 7.25,
    'TON/USDT': 7.55,
    'NOT/USDT': 0.0155,
    'PEPE/USDT': 0.0000125,
    // Forex
    'EUR/USD': 1.0750,
    'GBP/USD': 1.2650,
    'USD/JPY': 158.50,
    'USD/CAD': 1.3700,
    'USD/CHF': 0.8950,
    'AUD/USD': 0.6650,
    'NZD/USD': 0.6120,
    'EUR/GBP': 0.8480,
    'EUR/JPY': 170.20,
    'GBP/JPY': 200.50,
    // Indices
    'SPX': 5450.0,
    'NDQ': 19500.0,
    'DJI': 39000.0,
    'VIX': 13.5,
    'DXY': 105.5,
    'DAX': 18000.0,
    'FTSE': 8200.0,
    'N225': 38500.0,
    // Stocks
    'AAPL': 215.0,
    'MSFT': 445.0,
    'NVDA': 125.0,
    'GOOGL': 175.0,
    'AMZN': 185.0,
    'TSLA': 180.0,
    'NFLX': 670.0,
    'META': 500.0,
    'AMD': 160.0,
    'INTC': 30.0,
    'COIN': 225.0,
    'BABA': 75.0
};

const CACHE_PATH = path.join(__dirname, 'price_cache.json');

const loadPriceCache = (): Record<string, number> => {
    try {
        if (fs.existsSync(CACHE_PATH)) {
            const data = fs.readFileSync(CACHE_PATH, 'utf8');
            const parsed = JSON.parse(data);
            console.log('📊 [Market] Loaded last known prices from cache file');
            return { ...FALLBACK_PRICES, ...parsed };
        }
    } catch (e) {
        console.error('📊 [Market] Failed to load price cache file:', e);
    }
    return { ...FALLBACK_PRICES };
};

export const savePriceCache = (cache: Record<string, number>) => {
    try {
        fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    } catch (e) {
        console.error('📊 [Market] Failed to save price cache file:', e);
    }
};

/**
 * Legacy mid-price map, kept for display-only consumers (market prices
 * endpoint, AI context). The authoritative two-sided quotes live in
 * services/pricing.ts — anything that executes, values a position or checks
 * margin must read from there, because a single mid price cannot express
 * which side of the book a fill happens on.
 */
export const priceCache: Record<string, number> = loadPriceCache();

/** Record a one-sided feed price: seeds the quote store and the legacy map. */
const ingestMid = (symbol: string, mid: number) => {
    if (!(mid > 0)) return;
    setMidPrice(symbol, mid);
    priceCache[symbol] = getMid(symbol)!;
};

/** Record a genuine two-sided quote (a real broker feed). */
export const ingestQuote = (symbol: string, bid: number, ask: number) => {
    if (!(bid > 0) || !(ask > 0)) return;
    setQuote(symbol, bid, ask);
    priceCache[symbol] = getMid(symbol)!;
};

/** Seed the quote store from whatever the cache file / fallbacks gave us. */
for (const [symbol, price] of Object.entries(priceCache)) {
    try { ingestMid(symbol, price); } catch { /* skip unusable seed */ }
}

/**
 * Synthetic tick drift. A real broker never invents prices, so this is off by
 * default: when enabled it only animates the display feed and is explicitly
 * excluded from the stop-loss / take-profit / stop-out path, which must only
 * ever act on prices the market actually printed.
 */
const SYNTHETIC_TICKS = process.env.SYNTHETIC_TICKS === 'true';

/** Payload every price emit uses, so clients get the spread they display. */
const quotePayload = (symbol: string) => {
    const q = getQuote(symbol);
    if (!q) return null;
    return {
        symbol,
        price: roundPrice(symbol, (q.bid + q.ask) / 2),
        bid: q.bid,
        ask: q.ask,
        spread: getSpreadPips(symbol),
        timestamp: new Date(q.ts),
    };
};

// Fetch live price from Yahoo Finance for traditional assets (or crypto fallback)
const fetchYahooPrice = async (symbol: string): Promise<number | null> => {
    try {
        const ticker = getYahooTicker(symbol);
        const quote = await yahooFinance.quoteSummary(ticker, { modules: ['price'] });
        const price = (quote.price as any)?.regularMarketPrice;
        return typeof price === 'number' ? price : null;
    } catch {
        return null;
    }
};

// Multi-endpoint Binance fetcher with auto-fallback mirrors
const BINANCE_ENDPOINTS = [
    'https://api.binance.com/api/v3',
    'https://api1.binance.com/api/v3',
    'https://api2.binance.com/api/v3',
    'https://api3.binance.com/api/v3',
    'https://api.binance.us/api/v3'
];

let binanceEndpointIndex = 0;

// Batch fetch Binance prices using resilient multi-endpoint strategy
const fetchAllBinancePrices = async (): Promise<Record<string, number>> => {
    for (let attempts = 0; attempts < BINANCE_ENDPOINTS.length; attempts++) {
        const baseUrl = BINANCE_ENDPOINTS[(binanceEndpointIndex + attempts) % BINANCE_ENDPOINTS.length];
        try {
            const res = await axios.get(`${baseUrl}/ticker/price`, { timeout: 4000 });
            if (res.data && Array.isArray(res.data)) {
                binanceEndpointIndex = (binanceEndpointIndex + attempts) % BINANCE_ENDPOINTS.length;
                const prices: Record<string, number> = {};
                for (const item of res.data) {
                    prices[item.symbol] = parseFloat(item.price);
                }
                return prices;
            }
        } catch (e: any) {
            console.log(`⚠️ [Market] Binance endpoint ${baseUrl} failed (${e.message}), trying next mirror...`);
        }
    }
    console.error('❌ [Market] All Binance endpoints timed out/failed in current tick');
    return {};
};

// Fetch price for a single symbol immediately (used on subscribe)
export const fetchSinglePrice = async (symbol: string): Promise<number | null> => {
    // For Crypto: Try Binance first (fastest and most accurate)
    if (isCrypto(symbol)) {
        const bSymbol = symbol.replace(/[\/-]/g, '');
        for (const baseUrl of BINANCE_ENDPOINTS) {
            try {
                const res = await axios.get(`${baseUrl}/ticker/price`, {
                    params: { symbol: bSymbol },
                    timeout: 3000
                });
                if (res.data && res.data.price) {
                    return parseFloat(res.data.price);
                }
            } catch {}
        }
    }

    // Try Yahoo for traditional assets or as crypto fallback
    try {
        const yahooPrice = await fetchYahooPrice(symbol);
        if (yahooPrice && yahooPrice > 0) {
            return yahooPrice;
        }
    } catch {}
    
    return priceCache[symbol] || FALLBACK_PRICES[symbol] || null;
};

export const setupMarketSockets = (io: Server) => {
    const activeSubscriptions = new Set<string>();
    const basePriceCache: Record<string, number> = {};

    io.on('connection', (socket) => {
        socket.on('subscribe', async (payload: any) => {
            if (!payload) return;
            
            const subscribeToSymbol = async (symbol: string) => {
                if (typeof symbol !== 'string') return;
                console.log(`[Market Socket] Client subscribing to: ${symbol}`);
                socket.join(symbol);
                const isNew = !activeSubscriptions.has(symbol);
                activeSubscriptions.add(symbol);

                // If we already have a cached price, send it immediately
                const cached = quotePayload(symbol);
                if (cached) socket.emit('priceUpdate', cached);
                
                // If this is a new symbol (no cached price), fetch immediately
                if (isNew || !priceCache[symbol]) {
                    try {
                        const price = await fetchSinglePrice(symbol);
                        if (price && price > 0) {
                            basePriceCache[symbol] = price;
                            ingestMid(symbol, price);
                            const payload = quotePayload(symbol);
                            if (payload) io.to(symbol).emit('priceUpdate', payload);
                            console.log(`📊 [Market] Fetched initial price for ${symbol}: ${price}`);
                        }
                    } catch (e) {
                        console.log(`[Market] Failed to fetch initial price for ${symbol}`);
                    }
                }
            };

            if (typeof payload === 'string') {
                await subscribeToSymbol(payload);
            } else if (payload && typeof payload === 'object') {
                if (Array.isArray(payload.symbols)) {
                    for (const sym of payload.symbols) {
                        await subscribeToSymbol(sym);
                    }
                } else if (typeof payload.symbol === 'string') {
                    await subscribeToSymbol(payload.symbol);
                }
            }
        });

        socket.on('unsubscribe', (payload: any) => {
            if (!payload) return;
            const unsubscribeFromSymbol = (symbol: string) => {
                if (typeof symbol !== 'string') return;
                socket.leave(symbol);
            };

            if (typeof payload === 'string') {
                unsubscribeFromSymbol(payload);
            } else if (payload && typeof payload === 'object') {
                if (Array.isArray(payload.symbols)) {
                    for (const sym of payload.symbols) {
                        unsubscribeFromSymbol(sym);
                    }
                } else if (typeof payload.symbol === 'string') {
                    unsubscribeFromSymbol(payload.symbol);
                }
            }
        });
    });

    // Real price fetch loop (every 10s) - BATCHED & SEPARATED
    setInterval(async () => {
        const symbols = Array.from(activeSubscriptions);
        if (symbols.length === 0) return;

        const cryptoSymbols = symbols.filter(isCrypto);
        const traditionalSymbols = symbols.filter(s => !isCrypto(s));

        // 1. Fetch Crypto prices from Binance (Fast, unlimited)
        if (cryptoSymbols.length > 0) {
            try {
                const binancePrices = await fetchAllBinancePrices();
                if (Object.keys(binancePrices).length > 0) {
                    for (const symbol of cryptoSymbols) {
                        const bSymbol = symbol.replace(/[\/-]/g, '');
                        if (binancePrices[bSymbol] && binancePrices[bSymbol] > 0) {
                            basePriceCache[symbol] = binancePrices[bSymbol];
                            ingestMid(symbol, binancePrices[bSymbol]);
                        }
                    }
                }
            } catch (e: any) {
                console.error('[Market] Binance batch price fetch error:', e.message);
            }
        }

        // 2. Fetch Traditional prices from Yahoo Finance
        if (traditionalSymbols.length > 0) {
            try {
                const tickersToFetch = traditionalSymbols.map(getYahooTicker);
                for (let i = 0; i < tickersToFetch.length; i += 10) {
                    const chunk = tickersToFetch.slice(i, i + 10);
                    const quotes = await yahooFinance.quote(chunk);
                    for (const quote of quotes) {
                        const price = (quote as any).regularMarketPrice;
                        if (price && price > 0) {
                            const originalSymbol = traditionalSymbols.find(s => getYahooTicker(s) === quote.symbol);
                            if (originalSymbol) {
                                basePriceCache[originalSymbol] = price;
                                ingestMid(originalSymbol, price);
                            }
                        }
                    }
                }
            } catch (e: any) {
                console.error("[Market] Yahoo Finance batch fetch failed for traditional assets:", e.message);
            }
        }

        // 3. Candle Low/High for pending order triggering
        const candleLowHigh: Record<string, { low: number; high: number; barStart: number }> = {};
        if (cryptoSymbols.length > 0) {
            const baseUrl = BINANCE_ENDPOINTS[binanceEndpointIndex];
            for (const symbol of cryptoSymbols) {
                try {
                    const bSymbol = symbol.replace(/[\/-]/g, '');
                    const res = await axios.get(`${baseUrl}/klines`, {
                        params: { symbol: bSymbol, interval: '1h', limit: 1 },
                        timeout: 3000
                    });
                    if (res.data && res.data[0]) {
                        candleLowHigh[symbol] = {
                            low: parseFloat(res.data[0][3]),
                            high: parseFloat(res.data[0][2]),
                            barStart: Number(res.data[0][0]),
                        };
                    }
                } catch {}
            }
        }

        // Also use Yahoo dayLow/dayHigh for traditional assets
        const traditionals = symbols.filter(s => !isCrypto(s));
        for (const symbol of traditionals) {
            try {
                const ticker = getYahooTicker(symbol);
                const quote = await yahooFinance.quoteSummary(ticker, { modules: ['price'] });
                const priceData = quote.price as any;
                if (priceData?.regularMarketDayLow && priceData?.regularMarketDayHigh) {
                    // This is the whole trading session's range, so it is only
                    // a legitimate trigger for orders placed before the
                    // session opened. Stamped accordingly.
                    const openMs = priceData.regularMarketTime
                        ? new Date(priceData.regularMarketTime).setUTCHours(0, 0, 0, 0)
                        : new Date().setUTCHours(0, 0, 0, 0);
                    candleLowHigh[symbol] = {
                        low: priceData.regularMarketDayLow,
                        high: priceData.regularMarketDayHigh,
                        barStart: openMs,
                    };
                }
            } catch {}
        }

        // Run the execution engines against real, market-printed prices only.
        for (const symbol of symbols) {
            const mid = getMid(symbol);
            if (mid === undefined) continue;

            // Candle low/high is only a valid trigger source for the bar the
            // order has actually lived through. `regularMarketDayLow/High` is
            // the whole session's range, so passing it here would activate a
            // pending order against a level the market touched hours before
            // the order existed. Intraday extremes are therefore only used
            // when they are fresher than the order — processPendingOrders
            // enforces that via the barStart timestamp.
            const lh = candleLowHigh[symbol];
            processPendingOrders(symbol, mid, lh?.low, lh?.high, lh?.barStart).catch(() => {});
            processTrailingStops(symbol, mid);
            processTPSL(symbol, mid).catch(() => {});
            processStopOuts(symbol, mid).catch(() => {});
        }
        savePriceCache(getAllMids());
    }, 10000);

    // Fast loop (every 1s).
    //
    // This used to invent a price with Math.random(), write it over the price
    // cache and then run trailing stops, take-profit/stop-loss and stop-outs
    // against it. Because the invented price replaced the cached one on every
    // pass, it random-walked away from the real market between the 10s fetches
    // — so a client's position could be stopped out by a move that never
    // happened. Execution now runs only in the real-data loop above.
    //
    // With SYNTHETIC_TICKS enabled the drift returns for demo purposes, but it
    // is emitted to clients only and never reaches the execution engines or
    // the quote store used to value positions.
    setInterval(() => {
        const symbols = Array.from(activeSubscriptions);
        for (const symbol of symbols) {
            if (SYNTHETIC_TICKS) {
                const base = getMid(symbol) ?? basePriceCache[symbol];
                if (!base) continue;
                const drift = (Math.random() - 0.5) * base * 0.0002;
                const spec = getSpreadPips(symbol) ?? 0;
                const mid = roundPrice(symbol, base + drift);
                io.to(symbol).emit('priceUpdate', {
                    symbol, price: mid, bid: mid, ask: mid,
                    spread: spec, synthetic: true, timestamp: new Date(),
                });
            } else {
                const payload = quotePayload(symbol);
                if (payload) io.to(symbol).emit('priceUpdate', payload);
            }
        }
    }, 1000);

    // Overnight financing. Checked every minute; accrueOvernightSwap only
    // acts inside the rollover hour and only once per date.
    setInterval(() => { accrueOvernightSwap().catch(() => {}); }, 60_000);

    // Global stop-out check — catches margin violations even for symbols
    // no one is actively viewing
    setInterval(async () => {
        try {
            await runGlobalStopOutCheck();
        } catch (e) {
            // silent
        }
    }, 2000);
};
