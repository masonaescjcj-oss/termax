import { Response } from 'express';
import OpenAI from 'openai';
import { AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { mapUserToCamel, mapPositionToCamel } from '../utils/mapper';
import { loadAIConfig } from '../utils/aiConfigManager';
import { priceCache } from '../sockets/marketSocket';

const LEVERAGE = 200;

const contractSizes: Record<string, number> = {
    'BTC/USDT': 1, 'ETH/USDT': 1, 'BNB/USDT': 1, 'SOL/USDT': 1,
    'XRP/USDT': 1, 'ADA/USDT': 1, 'DOGE/USDT': 1, 'AVAX/USDT': 1,
    'LINK/USDT': 1, 'DOT/USDT': 1, 'MATIC/USDT': 1, 'SHIB/USDT': 1,
    'LTC/USDT': 1, 'TRX/USDT': 1, 'UNI/USDT': 1,
    'GOLD': 100, 'SILVER': 5000, 'USOIL': 1000,
    'SPX': 1, 'NDQ': 1, 'DJI': 1, 'VIX': 1, 'DXY': 1,
    'AAPL': 1, 'MSFT': 1, 'NVDA': 1, 'GOOGL': 1, 'AMZN': 1, 'TSLA': 1, 'NFLX': 1,
};

const pnlMultipliers: Record<string, number> = {
    'BTC/USDT': 1, 'ETH/USDT': 1, 'BNB/USDT': 1, 'SOL/USDT': 1,
    'XRP/USDT': 1, 'ADA/USDT': 1, 'DOGE/USDT': 1, 'AVAX/USDT': 1,
    'LINK/USDT': 1, 'DOT/USDT': 1, 'MATIC/USDT': 1, 'SHIB/USDT': 1,
    'LTC/USDT': 1, 'TRX/USDT': 1, 'UNI/USDT': 1,
    'GOLD': 100, 'SILVER': 5000, 'USOIL': 1000,
    'SPX': 1, 'NDQ': 1, 'DJI': 1, 'VIX': 1, 'DXY': 1,
    'AAPL': 1, 'MSFT': 1, 'NVDA': 1, 'GOOGL': 1, 'AMZN': 1, 'TSLA': 1, 'NFLX': 1,
};

function calcMarginRequired(symbol: string, volume: number, price: number): number {
    const cs = contractSizes[symbol] || 1;
    return (volume * cs * price) / LEVERAGE;
}

function calcUnrealizedPnL(pos: any): number {
    const mult = pnlMultipliers[pos.symbol] || 1;
    const currentPrice = priceCache[pos.symbol] || pos.entryPrice;
    const diff = pos.side === 'BUY' ? (pos.closePrice || currentPrice) - pos.entryPrice : pos.entryPrice - (pos.closePrice || currentPrice);
    return (diff * pos.volume * mult) - (pos.commission || 0);
}

/**
 * Handle chat requests for MaxAI (formerly AI Coach)
 * Performs analysis on user demo balance and open positions, then queries Mimo 2.5 Pro
 */
export const chatWithMaxAI = async (req: AuthRequest, res: Response) => {
    try {
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        // 1. Fetch user data
        const { data: rawUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.user!.id)
            .single();

        const user = mapUserToCamel(rawUser);
        const demoAccount = user?.cTraderAccounts?.find((a: any) => a.accountType === 'DEMO');

        // 2. Fetch active positions
        const { data: rawPositions } = await supabase
            .from('positions')
            .select('*')
            .eq('user_id', req.user!.id)
            .eq('status', 'OPEN');

        const positions = (rawPositions || []).map(mapPositionToCamel);

        // 3. Compute active context variables
        const balance = demoAccount?.balance || 10000;
        const unrealizedPnl = positions.reduce((sum: number, p: any) => sum + calcUnrealizedPnL(p), 0);
        const equity = balance + unrealizedPnl;
        const marginUsed = positions.reduce((sum: number, p: any) => sum + calcMarginRequired(p.symbol, p.volume, p.entryPrice), 0);
        const freeMargin = Math.max(0, equity - marginUsed);
        const openCount = positions.length;

        // 4. Construct high-fidelity system prompt
        const activeTradesDesc = positions
            .map((p: any) => `${p.side} ${p.volume} Lot ${p.symbol} (Entry: ${p.entryPrice}, Current PnL: $${calcUnrealizedPnL(p).toFixed(2)})`)
            .join(', ') || 'None';

        const systemPrompt = `You are MaxAI, a premier institutional trading intelligence assistant built inside the cTrade platform.
You assist traders with smart market analytics, risk management, and order execution advice using advanced Smart Money Concepts (SMC), liquidity analysis, and macroeconomic insights.

User Profile & Live Trading Stats:
- Equity: $${equity.toFixed(2)}
- Free Margin: $${freeMargin.toFixed(2)}
- Active Positions Count: ${openCount}
- Active Positions Details: ${activeTradesDesc}

Formatting Constraints:
- Keep your answers clean, well-formatted, concise, and professional.
- Do not repeat raw technical definitions unless asked; focus on direct actionable context.
- Use markdown lists, bold headers, and bullet points.

Custom Interactive Widgets:
1. When the user requests a trade setup, signal, or forecast, append this JSON block at the very end of your response:
\`\`\`json
{
  "type": "signal",
  "data": { "symbol": "BTC/USDT", "side": "BUY", "entry": 62000, "tp": 65000, "sl": 60000, "confidence": 90 }
}
\`\`\`

2. When the user asks about risk parameters, account health, or position auditing, append this JSON block at the very end of your response:
\`\`\`json
{
  "type": "risk_report",
  "data": { "score": 85, "openTrades": ${openCount}, "equity": ${equity.toFixed(2)}, "suggestions": ["Reduce EUR/USD exposure", "Use trailing stop to secure profits"] }
}
\`\`\`
`;

        // 5. Build and send request messages
        const apiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-10).map((m: any) => ({
                role: m.role,
                content: m.content
            }))
        ];

        const config = await loadAIConfig();
        
        let client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl
        });
        
        let completion;
        try {
            console.log(`[AI] Dispatching query to primary model: ${config.modelName} via: ${config.baseUrl}`);
            completion = await client.chat.completions.create({
                model: config.modelName,
                messages: apiMessages as any,
                temperature: 0.7,
                max_tokens: 600,
            });
        } catch (primaryError: any) {
            console.error('[AI] Primary provider failed:', primaryError.message || primaryError);
            if (config.fallbackApiKey) {
                console.log(`[AI] Swapping to fallback: ${config.fallbackModelName} via: ${config.fallbackBaseUrl}`);
                const fallbackClient = new OpenAI({
                    apiKey: config.fallbackApiKey,
                    baseURL: config.fallbackBaseUrl || 'https://api.openai.com/v1'
                });
                completion = await fallbackClient.chat.completions.create({
                    model: config.fallbackModelName || 'gpt-4o',
                    messages: apiMessages as any,
                    temperature: 0.7,
                    max_tokens: 600,
                });
            } else {
                throw primaryError;
            }
        }

        let replyContent = completion.choices[0]?.message?.content || "I am unable to process that at the moment.";
        let widget = null;

        // Extract JSON codeblock if present
        const jsonMatch = replyContent.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            try {
                widget = JSON.parse(jsonMatch[1]);
                replyContent = replyContent.replace(jsonMatch[0], '').trim();
            } catch (e) {
                console.error("MaxAI Widget Parsing Failed:", e);
            }
        }

        res.status(200).json({
            reply: {
                role: 'assistant',
                content: replyContent,
                widget
            }
        });

    } catch (error: any) {
        console.error('MaxAI Controller Error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Communication failure with MaxAI brain',
            details: error.message
        });
    }
};
