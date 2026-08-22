import { Response } from 'express';
import OpenAI from 'openai';
import { AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { mapUserToCamel, mapPositionToCamel } from '../utils/mapper';
import { loadAIConfig } from '../utils/aiConfigManager';
import { accountMetrics, unrealizedPnL, marginRequired } from '../services/pricing';

/**
 * The AI reads the trader's live account, so it must use the same maths as the
 * engine. This file previously carried its own copy of the contract-size and
 * P/L-multiplier tables — the sixth in the codebase, and like the others it
 * contained no forex pairs, so MaxAI quoted a trader's EUR/USD equity and risk
 * 100,000x too small while sounding completely certain about it.
 */

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
        const balance = demoAccount?.balance ?? 0;
        const metrics = accountMetrics(balance, positions as any);
        const equity = metrics.equity;
        const marginUsed = metrics.margin;
        const freeMargin = metrics.freeMargin;
        const openCount = positions.length;

        // 4. Construct high-fidelity system prompt
        const activeTradesDesc = positions
            .map((p: any) => {
                const pnl = unrealizedPnL(p as any);
                // Say so rather than printing a zero that reads like a fact.
                const pnlText = pnl === null || pnl === undefined ? 'not priced yet' : `$${pnl.toFixed(2)}`;
                return `${p.side} ${p.volume} Lot ${p.symbol} (Entry: ${p.entryPrice}, Current PnL: ${pnlText})`;
            })
            .join(', ') || 'None';

        // Positions the feed cannot value would otherwise silently drop out of
        // equity and margin, so the model is told instead of being misled.
        const unpricedNote = metrics.unpriced.length
            ? `\n- NOTE: no live price for ${metrics.unpriced.join(', ')}; these are excluded from equity and margin above.`
            : '';

        const systemPrompt = `You are MaxAI, a premier institutional trading intelligence assistant built inside the cTrade platform.
You assist traders with smart market analytics, risk management, and order execution advice using advanced Smart Money Concepts (SMC), liquidity analysis, and macroeconomic insights.

User Profile & Live Trading Stats:
- Equity: $${equity.toFixed(2)}
- Free Margin: $${freeMargin.toFixed(2)}
- Active Positions Count: ${openCount}
- Margin Used: $${marginUsed.toFixed(2)}\n- Active Positions Details: ${activeTradesDesc}${unpricedNote}

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
