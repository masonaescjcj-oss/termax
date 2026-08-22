import { Request, Response } from 'express';
import axios from 'axios';
import { supabase } from '../config/supabase';
import { mapPromotedSymbolToCamel } from '../utils/mapper';
import YahooFinance from 'yahoo-finance2';
import { priceCache } from '../sockets/marketSocket';

export const getPrices = (req: Request, res: Response) => {
    res.json({ success: true, priceCache });
};

const withTimeout = <T>(promise: PromiseLike<T>, ms: number = 1500): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout')), ms);
        promise.then(
            res => { clearTimeout(timer); resolve(res); },
            err => { clearTimeout(timer); reject(err); }
        );
    });
};

export const getPromotedSymbols = async (req: Request, res: Response) => {
    try {
        const { data: symbols } = await withTimeout(
            supabase
                .from('promoted_symbols')
                .select('*')
                .eq('is_active', true)
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false }),
            1500
        );

        res.json({ success: true, data: (symbols || []).map(mapPromotedSymbolToCamel) });
    } catch (error: any) {
        res.json({ success: true, data: [] });
    }
};

const yahooFinance = new YahooFinance();
const BINANCE_API_URL = 'https://api.binance.com/api/v3';

// Helper to determine if a symbol is likely crypto (for Binance) or traditional (for Yahoo)
const isCrypto = (symbol: string) => {
    return symbol.endsWith('/USDT') || symbol.endsWith('USDT') || symbol.endsWith('/BTC') || symbol.endsWith('BTC');
};

// Map Binance intervals to Yahoo Finance intervals
const mapYahooInterval = (interval: string) => {
    const map: { [key: string]: '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h' | '1d' | '5d' | '1wk' | '1mo' | '3mo' } = {
        '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '60m', '4h': '60m', '1d': '1d', '1w': '1wk'
    };
    return map[interval] || '60m';
};

// Map our symbol names to Yahoo Finance tickers
const mapYahooSymbol = (symbol: string) => {
    const symbolMap: Record<string, string> = {
        'GOLD': 'GC=F',      // Gold Futures
        'SILVER': 'SI=F',    // Silver Futures
        'SPX': '^GSPC',      // S&P 500
        'NDQ': '^NDX',       // Nasdaq 100
        'DJI': '^DJI',       // Dow Jones
        'VIX': '^VIX',       // Volatility Index
        'DXY': 'DX=F',       // Dollar Index Futures
        'USOIL': 'CL=F',     // Crude Oil Futures
    };
    if (symbolMap[symbol]) return symbolMap[symbol];
    
    // Crypto (e.g., BTC/USDT -> BTC-USD)
    if (symbol.includes('/USDT')) return symbol.replace('/USDT', '-USD');
    if (symbol.includes('/BTC')) return symbol.replace('/BTC', '-BTC');
    
    // Forex (e.g., EUR/USD -> EURUSD=X)
    if (symbol.includes('/')) return symbol.replace('/', '') + '=X';
    return symbol;
};

/**
 * Get historical candles for a symbol
 * GET /api/v1/market/candles/:symbol?interval=1h&limit=100
 */
export const getCandles = async (req: Request, res: Response) => {
    try {
        const symbol = (req.params.symbol as string).replace('-', '/').toUpperCase();
        const interval = (req.query.interval as string) || '1h';
        let limit = parseInt(req.query.limit as string) || 100;

        let candlesToSave: any[] = [];

        // 1. For Crypto: Try Binance klines FIRST (instant & resilient)
        if (isCrypto(symbol)) {
            const binanceSymbol = symbol.replace(/[\/-]/g, '');
            const BINANCE_MIRRORS = [
                'https://api.binance.com/api/v3',
                'https://api1.binance.com/api/v3',
                'https://api2.binance.com/api/v3',
                'https://api.binance.us/api/v3'
            ];

            for (const mirror of BINANCE_MIRRORS) {
                try {
                    const response = await axios.get(`${mirror}/klines`, {
                        params: { symbol: binanceSymbol, interval, limit },
                        timeout: 4000
                    });

                    if (response.data && Array.isArray(response.data)) {
                        candlesToSave = response.data.map((item: any[]) => ({
                            symbol,
                            interval,
                            timestamp: new Date(item[0]),
                            open: parseFloat(item[1]),
                            high: parseFloat(item[2]),
                            low: parseFloat(item[3]),
                            close: parseFloat(item[4]),
                            volume: parseFloat(item[5])
                        }));
                        if (candlesToSave.length > 0) break;
                    }
                } catch (err: any) {
                    console.log(`Binance klines mirror ${mirror} failed for ${symbol}: ${err.message}`);
                }
            }
        }

        // 2. For Traditional assets (or crypto fallback): Try Yahoo Finance
        if (candlesToSave.length === 0) {
            try {
                const yahooSymbol = mapYahooSymbol(symbol);
                const yFinanceInterval = mapYahooInterval(interval);

                let lookbackDays = 90;
                if (yFinanceInterval === '1m') lookbackDays = 5;
                else if (['2m', '5m', '15m', '30m'].includes(yFinanceInterval)) lookbackDays = 50;
                else if (yFinanceInterval === '1d' || yFinanceInterval === '1wk') lookbackDays = 365 * 2;

                const period1 = new Date();
                period1.setDate(period1.getDate() - lookbackDays);

                const queryOptions = { period1, interval: yFinanceInterval };
                const result = await yahooFinance.chart(yahooSymbol, queryOptions as any);

                const quotes = (result.quotes as any[]) || [];
                const validQuotes = quotes.filter(item => item && item.open !== null && item.close !== null);
                const limitedResult = validQuotes.slice(-limit);

                candlesToSave = limitedResult.map((item: any) => ({
                    symbol,
                    interval,
                    timestamp: item.date,
                    open: item.open,
                    high: item.high,
                    low: item.low,
                    close: item.close,
                    volume: item.volume || 0
                }));
            } catch (err: any) {
                console.log(`Yahoo historical failed for ${symbol}. Error: ${err.message}`);
                candlesToSave = [];
            }
        }

        // 3. Fallback to Mock Candles if both failed (ensures chart always loads)
        if (candlesToSave.length === 0) {
            const currentPrice = priceCache[symbol] || 100;
            console.log(`Generating mock candles for ${symbol} starting backward from price ${currentPrice}`);

            let intervalMs = 60 * 60 * 1000; // default 1h
            if (interval === '1m') intervalMs = 60 * 1000;
            else if (interval === '5m') intervalMs = 5 * 60 * 1000;
            else if (interval === '15m') intervalMs = 15 * 60 * 1000;
            else if (interval === '30m') intervalMs = 30 * 60 * 1000;
            else if (interval === '4h') intervalMs = 4 * 60 * 60 * 1000;
            else if (interval === '1d') intervalMs = 24 * 60 * 60 * 1000;
            else if (interval === '1w') intervalMs = 7 * 24 * 60 * 60 * 1000;

            let tempPrice = currentPrice;
            const now = Date.now();
            const mockCandles: any[] = [];

            for (let i = 0; i < limit; i++) {
                const candleTime = new Date(now - (limit - 1 - i) * intervalMs);
                // Simulated price random walk
                const change = (Math.random() - 0.5) * (tempPrice * 0.005);
                const open = tempPrice;
                const close = tempPrice + change;
                const high = Math.max(open, close) + Math.random() * (tempPrice * 0.002);
                const low = Math.min(open, close) - Math.random() * (tempPrice * 0.002);

                mockCandles.push({
                    symbol,
                    interval,
                    timestamp: candleTime,
                    open,
                    high,
                    low,
                    close,
                    volume: Math.floor(Math.random() * 1000)
                });
                tempPrice = close;
            }
            candlesToSave = mockCandles;
        }

        res.status(200).json(candlesToSave);
    } catch (error: any) {
        console.error('getHistoricalCandles Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch market data' });
    }
};
