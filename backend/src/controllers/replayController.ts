/**
 * REPLAY MODE — candle-by-candle practice against history, optionally
 * versus one of the user's bots.
 *
 * The server hands over one sealed package: the candle window plus the
 * bot's trades over that exact window, computed by the REAL backtest
 * engine (real costs). The client reveals candles one at a time and
 * keeps the user's paper score in pips; the comparison at the end is
 * pips-vs-pips on identical data. Nothing here touches accounts.
 */

import { Response } from 'express';
import Bot from '../models/Bot';
import { AuthRequest } from '../middleware/auth';
import { runBacktest } from '../services/backtest/engine';
import { backfillRange, coverage } from '../services/candles/backfill';
import { readBars, readBarsTf } from '../services/candles/store';
import { BarContext, BotState, TIMEFRAMES, TIMEFRAME_MS, Timeframe } from '../services/strategy/types';
import { compileStrategy } from '../services/strategy/interpreter';
import { hasExplainableRules, primaryTree, renderTrace, traceHeadline } from '../services/strategy/trace';

const MAX_CANDLES = 500;
const WARMUP_CANDLES = 60;

export const startReplay = async (req: AuthRequest, res: Response) => {
    try {
        const { botId, days } = req.body ?? {};
        const learn = req.body?.learn === true || req.body?.learn === 'true';
        let symbol = String(req.body?.symbol ?? '');
        let timeframe = String(req.body?.timeframe ?? '15m') as Timeframe;
        let spec: any = null;
        let botName: string | null = null;

        if (botId) {
            const bot = await Bot.findById(String(botId));
            if (!bot || bot.userId !== req.user!.id) {
                return res.status(404).json({ success: false, message: 'Bot not found' });
            }
            spec = bot.spec;
            botName = bot.name;
            symbol = bot.spec.symbol;
            timeframe = bot.spec.timeframe;
        }
        if (!symbol) return res.status(400).json({ success: false, message: 'symbol (or botId) is required' });
        if (!TIMEFRAMES.includes(timeframe)) {
            return res.status(400).json({ success: false, message: `timeframe must be one of ${TIMEFRAMES.join(', ')}` });
        }

        const windowDays = Math.min(90, Math.max(2, Number(days) || 30));
        const toMs = Date.now();
        const fromMs = toMs - windowDays * 86_400_000;

        if (coverage(symbol, fromMs, toMs) < 0.3) {
            await backfillRange(symbol, fromMs, toMs);
        }

        const candles = readBarsTf(symbol, timeframe, fromMs, toMs).slice(-MAX_CANDLES);
        if (candles.length < WARMUP_CANDLES + 40) {
            return res.status(422).json({
                success: false,
                message: `Not enough stored history for ${symbol} ${timeframe} to replay. Crypto and cTrader-covered symbols work best.`,
            });
        }

        // The bot plays the SAME window through the real engine.
        let botTrades: any[] = [];
        if (spec) {
            const start = candles[0].time;
            const end = candles[candles.length - 1].time + TIMEFRAME_MS[timeframe];
            const bars1m = readBars(symbol, start, end);
            if (bars1m.length >= 100) {
                try {
                    const result = runBacktest(spec, bars1m, { startBalance: 10_000 });
                    botTrades = result.trades.map(t => ({
                        side: t.side,
                        entryTime: t.entryTime,
                        entryPrice: t.entryPrice,
                        exitTime: t.exitTime,
                        exitPrice: t.exitPrice,
                        pips: Number(t.pips.toFixed(1)),
                        exitReason: t.exitReason,
                    }));
                } catch (e: any) {
                    console.warn('[Replay] Bot simulation failed:', e.message);
                }
            }
        }

        // ── learn mode ──────────────────────────────────────────────
        // Per-bar explanations of the bot's decision, rendered here so the
        // client can reveal one with each candle without another request.
        // The trace comes from the interpreter's own evaluation pass, so
        // what the learner reads cannot drift from what the engine did.
        let lessons: any[] = [];
        if (learn && spec && hasExplainableRules(spec)) {
            try {
                lessons = explainWindow(spec, candles, timeframe);
            } catch (e: any) {
                console.warn('[Replay] Explanation failed:', e.message);
            }
        }

        res.status(200).json({
            success: true,
            data: {
                symbol,
                timeframe,
                botName,
                warmup: WARMUP_CANDLES,
                candles,
                botTrades,
                botTotalPips: Number(botTrades.reduce((s, t) => s + t.pips, 0).toFixed(1)),
                learn,
                lessons,
            },
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/**
 * Replay the window through a traced interpreter and render one lesson
 * per bar.
 *
 * This is a second pass over the same candles rather than a hook into the
 * backtest, and that is deliberate: the backtest runs on 1-minute bars to
 * price stops and fills, while the decision the learner is reading was
 * taken on the spec timeframe. Explaining the 1m pass would show them a
 * hundred bars of nothing per decision.
 *
 * The position model here is intentionally coarse — entry at the close,
 * exit on a signal — because the lesson is about *why the rules fired*,
 * not about the fill. The bot's real trades, with real costs, come from
 * the backtest above and are what the score is compared against.
 */
function explainWindow(spec: any, candles: any[], timeframe: Timeframe) {
    const strat = compileStrategy(spec, { trace: true });
    let state: BotState = { dayKey: '', tradesToday: 0, barsInPosition: 0, cooldown: 0 } as BotState;
    let position: any = null;
    const out: any[] = [];

    for (const bar of candles) {
        const ctx = { position, spreadPips: 0 } as BarContext;
        const step = strat.onBar(timeframe, bar, state, ctx);
        state = step.state;

        if (step.decision.enter) {
            position = { side: step.decision.enter.side, entryPrice: bar.close, volume: 0.01 };
        } else if (step.decision.exit) {
            position = null;
        }

        const trace = strat.lastTrace();
        if (!trace) continue;
        const primary = primaryTree(trace);
        out.push({
            time: bar.time,
            outcome: trace.outcome,
            inPosition: trace.inPosition,
            blockedBy: trace.blockedBy ?? null,
            headline: traceHeadline(trace, 'en'),
            title: primary.title,
            lines: renderTrace(primary.node, 'en'),
        });
    }
    return out;
}
