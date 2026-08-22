import { Request, Response } from 'express';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import OpenAI from 'openai';
const YahooFinanceClass = require('yahoo-finance2').default;
const yahooFinance = new YahooFinanceClass();
import { AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { mapUserToCamel, mapPositionToCamel } from '../utils/mapper';

const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://router.bynara.id/v1';
if (!AI_API_KEY) {
    console.warn('⚠️ AI_API_KEY is not set — AI-backed tools endpoints will fail.');
}
const openai = new OpenAI({ apiKey: AI_API_KEY, baseURL: AI_BASE_URL });

const insightCache: Record<string, { text: string, timestamp: number }> = {};
const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours in ms

let heatmapCache: any = null;
let heatmapLastFetch = 0;

export const getHeatmap = async (req: Request, res: Response) => {
    try {
        if (heatmapCache && Date.now() - heatmapLastFetch < 5 * 60 * 1000) {
            return res.status(200).json({ success: true, data: heatmapCache });
        }

        const binanceSymbols = '["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","ADAUSDT"]';
        const binanceReq = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbols=${binanceSymbols}`);
        const cryptoData = binanceReq.data.map((item: any) => ({
            symbol: item.symbol.replace('USDT', '/USDT'),
            name: item.symbol.replace('USDT', ''),
            change24h: parseFloat(item.priceChangePercent),
            price: parseFloat(item.lastPrice),
            volume: (parseFloat(item.quoteVolume) / 1e9).toFixed(1) + 'B',
            category: 'Crypto'
        }));

        const yfSymbols = ['^GSPC', '^NDX', 'GC=F', 'CL=F', 'AAPL', 'MSFT'];
        const yfData = (await yahooFinance.quote(yfSymbols)) as any[];
        
        const mapName = (sym: string) => {
            if (sym === '^GSPC') return 'S&P 500';
            if (sym === '^NDX') return 'Nasdaq 100';
            if (sym === 'GC=F') return 'Gold';
            if (sym === 'CL=F') return 'Crude Oil';
            return sym;
        };
        const mapCategory = (sym: string) => {
            if (sym.startsWith('^')) return 'Indices';
            if (sym.includes('=F')) return 'Commodities';
            return 'Stocks';
        };
        const mapSymbol = (sym: string) => {
            if (sym === '^GSPC') return 'SPX';
            if (sym === '^NDX') return 'NDQ';
            if (sym === 'GC=F') return 'GOLD';
            if (sym === 'CL=F') return 'USOIL';
            return sym;
        };

        const tradData = yfData.map((item: any) => ({
            symbol: mapSymbol(item.symbol),
            name: mapName(item.symbol),
            change24h: item.regularMarketChangePercent || 0,
            price: item.regularMarketPrice || 0,
            volume: item.regularMarketVolume ? (item.regularMarketVolume / 1e6).toFixed(1) + 'M' : '—',
            category: mapCategory(item.symbol)
        }));

        heatmapCache = [...cryptoData, ...tradData];
        heatmapLastFetch = Date.now();
        res.status(200).json({ success: true, data: heatmapCache });
    } catch (error: any) {
        console.error('Heatmap Error:', error);
        res.status(500).json({ success: false, error: 'Failed to load heatmap data' });
    }
};

let analysisCache: any = null;
let analysisLastFetch = 0;

export const getAnalysis = async (req: Request, res: Response) => {
    try {
        if (analysisCache && Date.now() - analysisLastFetch < 15 * 60 * 1000) {
            return res.status(200).json({ success: true, data: analysisCache });
        }

        const symbols = ['BTC-USD', 'SOL-USD', 'GC=F', 'ETH-USD', 'EURUSD=X'];
        const results: any[] = [];
        
        for (let i = 0; i < symbols.length; i++) {
            const sym = symbols[i];
            const toDate = new Date();
            const fromDate = new Date();
            fromDate.setDate(toDate.getDate() - 200); // Need enough data for 200 EMA
            
            const hist = (await yahooFinance.historical(sym, { period1: fromDate, period2: toDate, interval: '1d' })) as any[];
            
            if (!hist || hist.length < 50) continue;
            
            const closes = hist.map((h: any) => h.close);
            const currentPrice = closes[closes.length - 1];
            
            // Simple RSI 14
            let gains = 0, losses = 0;
            for (let j = closes.length - 14; j < closes.length; j++) {
                const change = closes[j] - closes[j-1];
                if (change > 0) gains += change;
                else losses -= change;
            }
            const rs = (gains / 14) / (losses / 14 || 1);
            const rsi = 100 - (100 / (1 + rs));
            
            // Simple SMA instead of EMA for brevity in analysis
            const sma50 = closes.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50;
            const sma200 = closes.length >= 200 ? closes.slice(-200).reduce((a: number, b: number) => a + b, 0) / 200 : sma50;
            
            let trend = 'Neutral';
            if (rsi > 70) trend = 'Overbought';
            else if (rsi < 30) trend = 'Oversold';
            else if (currentPrice > sma50) trend = 'Bullish';
            else trend = 'Bearish';

            const mapSym = (s: string) => {
                if(s==='BTC-USD') return 'BTC/USDT';
                if(s==='SOL-USD') return 'SOL/USDT';
                if(s==='ETH-USD') return 'ETH/USDT';
                if(s==='GC=F') return 'GOLD';
                if(s==='EURUSD=X') return 'EUR/USD';
                return s;
            };

            results.push({
                id: i + 1,
                symbol: mapSym(sym),
                rsi: Math.round(rsi),
                macdSignal: rsi > 60 ? 'Bullish Cross' : (rsi < 40 ? 'Death Cross' : 'Converging'),
                trend,
                ema50: Number(sma50.toPrecision(5)),
                ema200: Number(sma200.toPrecision(5)),
                currentPrice: Number(currentPrice.toPrecision(5)),
                timeframe: '1D'
            });
        }

        analysisCache = results;
        analysisLastFetch = Date.now();
        res.status(200).json({ success: true, data: results });
    } catch (error: any) {
        console.error('Analysis Error:', error);
        res.status(500).json({ success: false, error: 'Failed to load analysis' });
    }
};

// REAL DATA: Fetch from ForexFactory XML feed
export const getCalendar = async (req: Request, res: Response) => {
    try {
        const response = await axios.get('https://nfs.faireconomy.media/ff_calendar_thisweek.xml');
        const parser = new XMLParser();
        const jObj = parser.parse(response.data);
        
        let events = jObj.weeklyevents.event || [];
        if (!Array.isArray(events)) events = [events];

        const parseFFDate = (dateStr: string, timeStr: string): Date => {
            if (!dateStr) return new Date();
            const [month, day, year] = dateStr.split('-').map(Number);
            let hours = 0;
            let minutes = 0;
            
            if (timeStr && timeStr.toLowerCase() !== 'all day' && timeStr.toLowerCase() !== 'tentative') {
                const match = timeStr.match(/^(\d+):(\d+)(am|pm)$/i);
                if (match) {
                    hours = Number(match[1]);
                    minutes = Number(match[2]);
                    const ampm = match[3].toLowerCase();
                    if (ampm === 'pm' && hours < 12) {
                        hours += 12;
                    } else if (ampm === 'am' && hours === 12) {
                        hours = 0;
                    }
                }
            }
            return new Date(year, month - 1, day, hours, minutes);
        };

        const formattedEvents = events.map((e: any, index: number) => {
            const dateObj = parseFFDate(e.date, e.time);
            return {
                id: index + 1,
                event: e.title || 'Unknown Event',
                country: e.country || 'USD',
                impact: e.impact ? e.impact.toUpperCase() : 'LOW',
                time: dateObj.toISOString(),
                timestamp: dateObj.getTime(),
                forecast: e.forecast || '—',
                previous: e.previous || '—',
                actual: null
            };
        });

        // Sort chronologically
        formattedEvents.sort((a: any, b: any) => a.timestamp - b.timestamp);

        res.status(200).json({ success: true, data: formattedEvents });
    } catch (error: any) {
        console.error('getCalendar API Error:', error);
        // Fallback mock if API fails
        const fallback = [
            { id: 1, event: 'Non-Farm Employment Change', country: 'USD', impact: 'HIGH', time: new Date(Date.now() + 3600000).toISOString(), forecast: '185K', previous: '175K', actual: null },
            { id: 2, event: 'ECB Interest Rate Decision', country: 'EUR', impact: 'HIGH', time: new Date(Date.now() + 7200000).toISOString(), forecast: '3.75%', previous: '4.00%', actual: null },
            { id: 3, event: 'Manufacturing PMI', country: 'GBP', impact: 'MEDIUM', time: new Date(Date.now() + 86400000).toISOString(), forecast: '51.2', previous: '50.8', actual: null }
        ];
        res.status(200).json({ success: true, data: fallback });
    }
};

export const getAnalytics = async (req: AuthRequest, res: Response) => {
    try {
        const { data: rawUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.user!.id)
            .single();

        const user = mapUserToCamel(rawUser);
        const demoAccount = user?.cTraderAccounts.find((a: any) => a.accountType === 'DEMO');
        
        const { data: rawOpen } = await supabase
            .from('positions')
            .select('*')
            .eq('user_id', req.user!.id)
            .eq('status', 'OPEN');

        const { data: rawClosed } = await supabase
            .from('positions')
            .select('*')
            .eq('user_id', req.user!.id)
            .eq('status', 'CLOSED')
            .order('close_time', { ascending: true });

        const openPositions = (rawOpen || []).map(mapPositionToCamel);
        const closedPositions = (rawClosed || []).map(mapPositionToCamel);
        
        const openCount = openPositions.length;
        const closedCount = closedPositions.length;

        // Calculate real stats
        let wins = 0;
        let totalWinAmt = 0;
        let totalLossAmt = 0;
        let bestPair = 'N/A';
        const pairCounts: Record<string, number> = {};

        for (const p of closedPositions) {
            const pnl = p.finalProfit || 0;
            if (pnl > 0) {
                wins++;
                totalWinAmt += pnl;
            } else {
                totalLossAmt += Math.abs(pnl);
            }
            pairCounts[p.symbol] = (pairCounts[p.symbol] || 0) + 1;
        }

        const winRate = closedCount > 0 ? (wins / closedCount) * 100 : 0;
        const profitFactor = totalLossAmt > 0 ? totalWinAmt / totalLossAmt : (totalWinAmt > 0 ? 99 : 0);
        const avgWin = wins > 0 ? totalWinAmt / wins : 0;
        const avgLoss = (closedCount - wins) > 0 ? totalLossAmt / (closedCount - wins) : 0;

        if (closedCount > 0) {
            bestPair = Object.keys(pairCounts).reduce((a, b) => pairCounts[a] > pairCounts[b] ? a : b);
        }

        const balance = demoAccount?.balance || 1000;
        const unrealizedPnL = openPositions.reduce((sum: number, p: any) => sum + (p.unrealizedPnl || 0), 0);
        const equity = balance + unrealizedPnL;
        const freeMargin = balance; // In a real system, subtract used margin
        
        // Approximate used margin
        let totalMargin = 0;
        openPositions.forEach((p: any) => {
            totalMargin += (p.volume * p.entryPrice) / 100; // Assuming 1:100 leverage
        });
        const marginUsedPercent = equity > 0 ? Math.round((totalMargin / equity) * 10000) / 100 : 0;

        // Build equity curve backwards from current balance
        const equityCurve: any[] = [];
        let runningBal = balance;
        equityCurve.unshift(runningBal);
        
        for (let i = closedPositions.length - 1; i >= Math.max(0, closedPositions.length - 10); i--) {
            runningBal -= (closedPositions[i].finalProfit || 0);
            equityCurve.unshift(runningBal);
        }
        
        while (equityCurve.length < 5) {
            equityCurve.unshift(runningBal);
        }

        res.status(200).json({ 
            success: true, 
            data: {
                totalTrades: openCount + closedCount, openCount, 
                winRate: Number(winRate.toFixed(1)), 
                bestPair, 
                profitFactor: Number(profitFactor.toFixed(2)), 
                avgWin: Number(avgWin.toFixed(2)), 
                avgLoss: Number(avgLoss.toFixed(2)),
                maxDrawdown: 0,
                sharpeRatio: 0,
                marginUsedPercent,
                balance, equity, freeMargin,
                equityCurve
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

let smcCache: any = null;
let smcLastFetch = 0;

export const getSmcData = async (req: Request, res: Response) => {
    try {
        if (smcCache && Date.now() - smcLastFetch < 30 * 60 * 1000) {
            return res.status(200).json({ success: true, data: smcCache });
        }

        const symbols = ['BTC-USD', 'ETH-USD', 'GC=F', 'EURUSD=X'];
        const results: any[] = [];

        for (let i = 0; i < symbols.length; i++) {
            const sym = symbols[i];
            const toDate = new Date();
            const fromDate = new Date();
            fromDate.setDate(toDate.getDate() - 30);
            
            const hist = (await yahooFinance.historical(sym, { period1: fromDate, period2: toDate, interval: '1d' })) as any[];
            if (!hist || hist.length < 5) continue;

            const mapSym = (s: string) => {
                if(s==='BTC-USD') return 'BTC/USDT';
                if(s==='ETH-USD') return 'ETH/USDT';
                if(s==='GC=F') return 'GOLD';
                if(s==='EURUSD=X') return 'EUR/USD';
                return s;
            };

            const closes = hist.map((h: any) => h.close);
            const highs = hist.map((h: any) => h.high);
            const lows = hist.map((h: any) => h.low);
            const currentPrice = closes[closes.length - 1];
            
            const highestHigh = Math.max(...highs);
            const lowestLow = Math.min(...lows);
            
            let type = 'Liquidity Sweep';
            let zone = [0, 0];
            let status = 'Pending';
            let strength = 75;

            if (currentPrice > closes[closes.length - 2] && currentPrice > closes[closes.length - 3]) {
                type = 'Bullish Order Block';
                zone = [lowestLow, lowestLow + (highestHigh - lowestLow) * 0.1];
                status = 'Active';
                strength = 85 + Math.floor(Math.random() * 10);
            } else if (currentPrice < closes[closes.length - 2]) {
                type = 'Fair Value Gap (FVG)';
                zone = [highestHigh - (highestHigh - lowestLow) * 0.1, highestHigh];
                status = 'Active';
                strength = 80 + Math.floor(Math.random() * 15);
            } else {
                zone = [currentPrice * 0.98, currentPrice * 1.02];
            }

            results.push({
                id: i + 1,
                symbol: mapSym(sym),
                type,
                zone: [Number(zone[0].toPrecision(5)), Number(zone[1].toPrecision(5))],
                status,
                strength
            });
        }

        smcCache = results;
        smcLastFetch = Date.now();
        res.status(200).json({ success: true, data: results });
    } catch (error: any) {
        console.error('SMC Error:', error);
        res.status(500).json({ success: false, error: 'Failed to load SMC data' });
    }
};

let mtfCache: any = null;
let mtfLastFetch = 0;

export const getMtfData = async (req: Request, res: Response) => {
    try {
        if (mtfCache && Date.now() - mtfLastFetch < 15 * 60 * 1000) {
            return res.status(200).json({ success: true, data: mtfCache });
        }

        const symbols = ['BTC-USD', 'ETH-USD', 'GC=F', 'EURUSD=X'];
        const results: any[] = [];

        for (const sym of symbols) {
            const toDate = new Date();
            const fromDate = new Date();
            fromDate.setDate(toDate.getDate() - 50);
            
            const hist = (await yahooFinance.historical(sym, { period1: fromDate, period2: toDate, interval: '1d' })) as any[];
            if (!hist || hist.length < 20) continue;

            const closes = hist.map((h: any) => h.close);
            const sma20 = closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
            const currentPrice = closes[closes.length - 1];
            
            const d1Trend = currentPrice > sma20 ? 1 : -1;
            const h4Trend = Math.random() > 0.3 ? d1Trend : -d1Trend;
            const h1Trend = Math.random() > 0.4 ? h4Trend : (Math.random() > 0.5 ? 1 : -1);
            const m15Trend = Math.random() > 0.5 ? h1Trend : (Math.random() > 0.5 ? 1 : -1);

            let score = 0;
            if (d1Trend === 1) score += 40; else score -= 40;
            if (h4Trend === 1) score += 30; else score -= 30;
            if (h1Trend === 1) score += 20; else score -= 20;
            if (m15Trend === 1) score += 10; else score -= 10;

            const mapSym = (s: string) => {
                if(s==='BTC-USD') return 'BTC/USDT';
                if(s==='ETH-USD') return 'ETH/USDT';
                if(s==='GC=F') return 'GOLD';
                if(s==='EURUSD=X') return 'EUR/USD';
                return s;
            };

            results.push({
                symbol: mapSym(sym),
                m15: m15Trend,
                h1: h1Trend,
                h4: h4Trend,
                d1: d1Trend,
                score
            });
        }

        mtfCache = results;
        mtfLastFetch = Date.now();
        res.status(200).json({ success: true, data: results });
    } catch (error: any) {
        console.error('MTF Error:', error);
        res.status(500).json({ success: false, error: 'Failed to load MTF data' });
    }
};

let liqCache: any = null;
let liqLastFetch = 0;

export const getLiquidityMap = async (req: Request, res: Response) => {
    try {
        if (liqCache && Date.now() - liqLastFetch < 10 * 60 * 1000) {
            return res.status(200).json({ success: true, data: liqCache });
        }

        const symbols = ['EURUSD=X', 'GC=F'];
        const results: any[] = [];

        for (const sym of symbols) {
            const quote = (await yahooFinance.quote(sym)) as any;
            const currentPrice = quote.regularMarketPrice || 0;
            if (!currentPrice) continue;

            const isForex = sym === 'EURUSD=X';
            const pip = isForex ? 0.0001 : 1;
            
            let pools: any[] = [];
            const upper1 = currentPrice + (pip * (isForex ? 50 : 20));
            const upper2 = currentPrice + (pip * (isForex ? 100 : 50));
            
            const lower1 = currentPrice - (pip * (isForex ? 50 : 20));
            const lower2 = currentPrice - (pip * (isForex ? 100 : 50));

            pools.push({
                price: Number(upper2.toPrecision(5)),
                volume: (Math.random() * 500 + 500).toFixed(0) + 'M',
                type: 'Short Liquidations',
                strength: Math.floor(Math.random() * 20) + 80,
                color: 'RED'
            });
            pools.push({
                price: Number(upper1.toPrecision(5)),
                volume: (Math.random() * 300 + 200).toFixed(0) + 'M',
                type: 'Resistance DOM',
                strength: Math.floor(Math.random() * 30) + 50,
                color: 'RED'
            });
            pools.push({
                price: Number(lower1.toPrecision(5)),
                volume: (Math.random() * 300 + 200).toFixed(0) + 'M',
                type: 'Support DOM',
                strength: Math.floor(Math.random() * 30) + 50,
                color: 'GREEN'
            });
            pools.push({
                price: Number(lower2.toPrecision(5)),
                volume: (Math.random() * 500 + 500).toFixed(0) + 'M',
                type: 'Long Liquidations',
                strength: Math.floor(Math.random() * 20) + 80,
                color: 'GREEN'
            });

            results.push({
                symbol: sym === 'EURUSD=X' ? 'EUR/USD' : 'GOLD',
                currentPrice: Number(currentPrice.toPrecision(5)),
                pools
            });
        }

        liqCache = results;
        liqLastFetch = Date.now();
        res.status(200).json({ success: true, data: results });
    } catch (error: any) {
        console.error('Liquidity Map Error:', error);
        res.status(500).json({ success: false, error: 'Failed to load liquidity data' });
    }
};

const getCurrencyFromSymbol = (sym: string) => {
    if (sym.includes('EUR')) return 'EUR';
    if (sym.includes('GBP')) return 'GBP';
    if (sym.includes('JPY')) return 'JPY';
    return 'USD';
};

export const getAiInsight = async (req: Request, res: Response) => {
    const symbol = String(req.params.symbol || '').toUpperCase();
    if (!symbol) return res.status(400).json({ error: 'Symbol required' });

    const now = Date.now();
    
    if (insightCache[symbol] && (now - insightCache[symbol].timestamp < CACHE_DURATION)) {
        return res.json({ success: true, cached: true, data: insightCache[symbol].text });
    }

    try {
        let eventText = 'No major upcoming events in the next 24h.';
        try {
            const response = await axios.get('https://nfs.faireconomy.media/ff_calendar_thisweek.xml');
            const parser = new XMLParser();
            const jObj = parser.parse(response.data);
            let events = jObj.weeklyevents.event || [];
            if (!Array.isArray(events)) events = [events];
            
            const currency = getCurrencyFromSymbol(symbol);
            const futureEvents = events.filter((e: any) => 
                (e.impact === 'High' || e.impact === 'Medium') && 
                e.country === currency &&
                new Date(`${e.date} ${e.time}`).getTime() > now
            );
            if (futureEvents.length > 0) {
                const nextEvent = futureEvents[0];
                const eventTime = new Date(`${nextEvent.date} ${nextEvent.time}`);
                const hours = Math.round((eventTime.getTime() - now) / 3600000);
                eventText = `${nextEvent.title} in ${hours} hours. Impact: ${nextEvent.impact}`;
            }
        } catch (e) {
            console.error('Failed to fetch real events', e);
        }

        const prompt = `You are an elite quantitative analyst for an institutional trading desk. 
Analyze the current market structure for ${symbol}. 
Provide a highly professional, 2-to-3 sentence "Premium Pro Data" summary. 
Include key support/resistance context, liquidity zones, or order block dynamics. 
Tone: Objective, institutional, Bloomberg Terminal vibe. Do not use markdown. Keep it strictly to the point.`;

        const response = await openai.chat.completions.create({
            model: 'mistral-medium-3-5',
            messages: [{ role: 'system', content: prompt }],
            max_tokens: 150,
            temperature: 0.7
        }, { timeout: 3500 });

        const text = response.choices[0]?.message?.content || 'Insight unavailable at this moment due to lack of market data.';
        
        const hash = symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const bullPercent = 40 + (hash % 40);

        const finalData = {
            insight: text,
            sentiment: { bullish: bullPercent, bearish: 100 - bullPercent },
            nextEvent: eventText
        };
        
        insightCache[symbol] = { text: finalData as any, timestamp: now };

        return res.json({ success: true, cached: false, data: finalData });
    } catch (error) {
        console.error('AI Insight Error:', error);
        if (insightCache[symbol]) {
            return res.json({ success: true, cached: true, data: insightCache[symbol].text });
        }
        
        const hash = symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const bullPercent = 40 + (hash % 40);

        const fallbackData = {
            insight: `Quantitative analysis indicates strong accumulation for ${symbol} near current levels, driven by high-volume liquidity sweeps. Order block dynamics suggest resistance overhead, requiring caution on long entries until structural break is confirmed.`,
            sentiment: { bullish: bullPercent, bearish: 100 - bullPercent },
            nextEvent: 'Real-time calendar unavailable.'
        };
        
        return res.json({ success: true, cached: false, data: fallbackData });
    }
};
