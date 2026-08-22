import { Server } from 'socket.io';
import axios from 'axios';
import YahooFinance from 'yahoo-finance2';
import { processTrailingStops, processTPSL, processStopOuts, runGlobalStopOutCheck, processPendingOrders } from '../controllers/tradeController';
import fs from 'fs';
import path from 'path';

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

// In-memory last known price cache initialized with fallback and saved values
export const priceCache: Record<string, number> = loadPriceCache();

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
                if (priceCache[symbol]) {
                    socket.emit('priceUpdate', {
                        symbol,
                        price: parseFloat(priceCache[symbol].toFixed(4)),
                        timestamp: new Date()
                    });
                }
                
                // If this is a new symbol (no cached price), fetch immediately
                if (isNew || !priceCache[symbol]) {
                    try {
                        const price = await fetchSinglePrice(symbol);
                        if (price && price > 0) {
                            basePriceCache[symbol] = price;
                            priceCache[symbol] = price;
                            // Emit to all clients subscribed to this symbol
                            io.to(symbol).emit('priceUpdate', {
                                symbol,
                                price: parseFloat(price.toFixed(4)),
                                timestamp: new Date()
                            });
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
                            priceCache[symbol] = binancePrices[bSymbol];
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
                                priceCache[originalSymbol] = price;
                            }
                        }
                    }
                }
            } catch (e: any) {
                console.error("[Market] Yahoo Finance batch fetch failed for traditional assets:", e.message);
            }
        }

        // 3. Candle Low/High for pending order triggering
        const candleLowHigh: Record<string, { low: number; high: number }> = {};
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
                            high: parseFloat(res.data[0][2])
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
                    candleLowHigh[symbol] = {
                        low: priceData.regularMarketDayLow,
                        high: priceData.regularMarketDayHigh
                    };
                }
            } catch {}
        }

        for (const symbol of symbols) {
            if (priceCache[symbol]) {
                const lh = candleLowHigh[symbol];
                processPendingOrders(
                    symbol,
                    priceCache[symbol],
                    lh?.low,
                    lh?.high
                ).catch(() => {});
            }
        }
        savePriceCache(priceCache);
    }, 10000);

    // Fast tick simulation loop (every 1s)
    setInterval(() => {
        const symbols = Array.from(activeSubscriptions);
        for (const symbol of symbols) {
            let basePrice = priceCache[symbol] || basePriceCache[symbol];
            if (basePrice) {
                const noise = basePrice * 0.0002;
                const change = (Math.random() - 0.5) * noise;
                const tickPrice = basePrice + change;
                
                priceCache[symbol] = tickPrice;
                
                io.to(symbol).emit('priceUpdate', {
                    symbol,
                    price: parseFloat(tickPrice.toFixed(4)),
                    timestamp: new Date()
                });

                processTrailingStops(symbol, tickPrice);
                processPendingOrders(symbol, tickPrice).catch(() => {});
                processTPSL(symbol, tickPrice).catch(() => {});
                processStopOuts(symbol, tickPrice).catch(() => {});
            }
        }
    }, 1000);

    // Global stop-out check every 5 seconds — catches margin violations
    // even for symbols no one is actively viewing
    setInterval(async () => {
        try {
            await runGlobalStopOutCheck();
        } catch (e) {
            // silent
        }
    }, 2000);
};
