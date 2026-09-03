/**
 * MaxAI — the chat brain, rebuilt on the tool layer (phase 5).
 *
 * Three rules, enforced structurally rather than by prompt hope:
 *  1. The model never computes a number. Every figure comes from a typed
 *     tool backed by the same pricing engine the trading path uses. The
 *     system prompt says so, and the tools make obeying cheaper than not.
 *  2. The model never executes anything. The only action-shaped tool
 *     returns a PROPOSAL the human confirms in the UI.
 *  3. Tokens are the real cost on this server, so: a static (cacheable)
 *     system prompt with no live numbers inlined, a per-day message quota,
 *     a hard cap on tool rounds, and a cheap-model path for smalltalk.
 */

import { Response } from 'express';
import OpenAI from 'openai';
import { AuthRequest } from '../middleware/auth';
import User from '../models/User';
import { loadAIConfig } from '../utils/aiConfigManager';
import { recordAIOk, recordAIFailure, describe as describeAIError } from '../services/aiHealth';
import { consumeMessage, dailyLimitFor, recordToolCalls } from '../services/ai/quota';
import { executeTool, toolSchemas } from '../services/ai/tools';

const MAX_TOOL_ROUNDS = 4;
const MAX_HISTORY_MESSAGES = 10;

/**
 * Static on purpose: no balances, no positions, no timestamps. OpenAI-style
 * providers cache long identical prompt prefixes automatically, and a prompt
 * that changes per request throws that discount away. Live data comes
 * through tools instead.
 */
const SYSTEM_PROMPT = `You are MaxAI, the trading intelligence assistant inside the Termax platform.

Always reply in English. Termax is an English-language product; do not switch
languages even if the user writes in another one.

HARD RULES — these are structural, not stylistic:
- NEVER compute, estimate, or recall a number about the user's account, positions, prices, indicators, or statistics. Call the matching tool and report ONLY what it returns. If a tool returns an error, say what is unavailable — never fill the gap with a guess.
- NEVER claim an order was placed. You cannot execute trades. For any setup or signal, call propose_order and present the proposal; the user decides in the app.
- Do not attach confidence percentages to predictions. Markets do not hand out calibrated confidence, and inventing one misleads.
- When you report a backtest, ALWAYS state its honesty grade next to the return, and mention its warnings.

Strategy building:
- Strategies are JSON StrategySpecs (validated server-side). Build them with save_strategy / run_backtest; when validation returns { errors }, fix exactly those paths and retry.
- Recommend forward testing before any live use. You cannot deploy anything live, and should say so if asked.

Style:
- Concise, professional, markdown-formatted. Lead with the answer.
- Numbers you cite must be traceable to a tool result from THIS conversation.

Widgets — append at most one JSON code block at the very end of a reply when it helps:
- ALWAYS after run_backtest succeeds, so the user can open it on the chart:
\`\`\`json
{ "type": "backtest_result", "data": { "backtestId": "...", "grade": "B", "honestyScore": 0, "netProfit": 0, "returnPct": 0, "trades": 0, "winRate": 0, "maxDrawdownPct": 0 } }
\`\`\`
  Copy every value from the tool result verbatim.
- A proposal from propose_order:
\`\`\`json
{ "type": "order_proposal", "data": { ...the tool's proposal object verbatim... } }
\`\`\`
- Account health, using tool numbers only:
\`\`\`json
{ "type": "risk_report", "data": { "equity": 0, "freeMargin": 0, "marginLevelPct": 0, "openTrades": 0, "suggestions": ["..."] } }
\`\`\`
`;

/** Smalltalk goes to the cheap path: no tools, short answer. */
export function isSmalltalk(text: string): boolean {
    const t = (text || '').trim().toLowerCase();
    if (!t || t.length > 60) return false;
    if (/\d/.test(t)) return false;
    const marketWords = /(price|quote|buy|sell|long|short|position|balance|equity|margin|pnl|profit|loss|bot|strategy|backtest|signal|setup|rsi|ema|sma|macd|chart|candle|trade|risk|خرید|فروش|قیمت|سیگنال|ربات|بک.?تست|پوزیشن|سود|ضرر|مارجین|استراتژی)/i;
    if (marketWords.test(t)) return false;
    return /^(hi|hello|hey|yo|thanks|thank you|ok|okay|cool|good (morning|evening|night)|how are you|سلام|درود|ممنون|مرسی|خوبی|چطوری|هی|اوکی|باشه)\b/.test(t)
        || t.length <= 12;
}

/** Strip legacy confidence fields a model might still emit. */
export function sanitizeWidget(widget: any): any {
    if (!widget || typeof widget !== 'object') return widget;
    if (widget.data && typeof widget.data === 'object') {
        delete widget.data.confidence;
        delete widget.data.score; // legacy risk "score" was also an invented number
    }
    return widget;
}

export const chatWithMaxAI = async (req: AuthRequest, res: Response) => {
    try {
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        // ── quota ───────────────────────────────────────────────────
        const user = await User.findById(req.user!.id);
        const limit = dailyLimitFor(user);
        const quota = await consumeMessage(req.user!.id, limit);
        if (!quota.allowed) {
            return res.status(429).json({
                error: 'Daily AI message limit reached',
                paywall: true,
                usage: { used: quota.used, limit: quota.limit, resetsAt: `${quota.day}T23:59:59Z` },
            });
        }

        const config = await loadAIConfig();
        const history = messages.slice(-MAX_HISTORY_MESSAGES).map((m: any) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content ?? ''),
        }));
        const lastUser = [...history].reverse().find(m => m.role === 'user')?.content ?? '';

        const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });

        const complete = async (body: any) => {
            try {
                const out = await client.chat.completions.create(body);
                recordAIOk('primary');
                return out;
            } catch (primaryError: any) {
                if (!config.fallbackApiKey) {
                    // Nothing to fall back to, so this is the outcome the
                    // admin needs to see on the console.
                    recordAIFailure(primaryError);
                    throw primaryError;
                }
                console.error('[AI] Primary provider failed:', describeAIError(primaryError));
                const fallback = new OpenAI({
                    apiKey: config.fallbackApiKey,
                    baseURL: config.fallbackBaseUrl || 'https://api.openai.com/v1',
                });
                try {
                    const out = await fallback.chat.completions.create({
                        ...body,
                        model: config.fallbackModelName || 'gpt-4o',
                    });
                    // Answered, but not by the provider that was supposed to
                    // — worth surfacing rather than hiding as a success.
                    recordAIOk('fallback');
                    return out;
                } catch (fallbackError: any) {
                    recordAIFailure(fallbackError);
                    throw fallbackError;
                }
            }
        };

        // ── cheap path: smalltalk needs no tools and no big model ───
        if (isSmalltalk(lastUser)) {
            const completion: any = await complete({
                model: config.modelName,
                messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
                temperature: 0.6,
                max_tokens: 150,
            });
            return res.status(200).json({
                reply: { role: 'assistant', content: completion.choices[0]?.message?.content ?? 'Hi!', widget: null },
                usage: { used: quota.used, limit: quota.limit },
            });
        }

        // ── tool loop ───────────────────────────────────────────────
        const convo: any[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...history];
        const tools = toolSchemas();
        let toolCallCount = 0;
        let finalText = '';

        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
            const lastRound = round === MAX_TOOL_ROUNDS;
            const completion: any = await complete({
                model: config.modelName,
                messages: convo,
                temperature: 0.4,
                max_tokens: 700,
                // The final round forbids more tools so the loop always ends
                // with prose, never with an unanswered tool request.
                ...(lastRound ? {} : { tools, tool_choice: 'auto' }),
            });

            const msg = completion.choices[0]?.message;
            if (!msg) break;

            const calls = msg.tool_calls ?? [];
            if (!calls.length || lastRound) {
                finalText = msg.content ?? '';
                break;
            }

            convo.push({ role: 'assistant', content: msg.content ?? null, tool_calls: calls });
            const results = await Promise.all(calls.map(async (c: any) => ({
                id: c.id,
                out: await executeTool(req.user!.id, c.function?.name, c.function?.arguments),
            })));
            toolCallCount += calls.length;
            for (const r of results) {
                convo.push({ role: 'tool', tool_call_id: r.id, content: JSON.stringify(r.out) });
            }
        }

        void recordToolCalls(req.user!.id, toolCallCount);

        // ── widget extraction ───────────────────────────────────────
        let replyContent = finalText || 'I could not produce an answer this time.';
        let widget: any = null;
        const jsonMatch = replyContent.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            try {
                widget = sanitizeWidget(JSON.parse(jsonMatch[1]));
                replyContent = replyContent.replace(jsonMatch[0], '').trim();
            } catch {
                /* malformed widget: leave the text as is */
            }
        }

        res.status(200).json({
            reply: { role: 'assistant', content: replyContent, widget },
            usage: { used: quota.used, limit: quota.limit, toolCalls: toolCallCount },
        });
    } catch (error: any) {
        // `details: error.message` handed the provider's raw error — key
        // fragments, internal URLs and all — to every client. The detail
        // stays in the server log and on the admin console; the user gets a
        // sentence that tells them what to do.
        console.error('MaxAI Controller Error:', describeAIError(error));
        res.status(503).json({
            error: 'MaxAI is unavailable right now. This is being looked at — please try again shortly.',
            code: 'AI_UNAVAILABLE',
        });
    }
};

/** The plan matrix, so the paywall screen shows the real limits. */
export const getPlans = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.user!.id);
        const { PLAN_LIMITS, planOf } = await import('../services/plans');
        res.status(200).json({
            success: true,
            data: { current: planOf(user), plans: PLAN_LIMITS },
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/** Today's quota state, for the client's counter/paywall. */
export const getAIUsage = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.user!.id);
        const limit = dailyLimitFor(user);
        const { getUsage } = await import('../services/ai/quota');
        const usage = await getUsage(req.user!.id);
        res.status(200).json({
            success: true,
            data: { used: usage.messages, limit, remaining: Math.max(0, limit - usage.messages), toolCalls: usage.toolCalls, day: usage.day },
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};
