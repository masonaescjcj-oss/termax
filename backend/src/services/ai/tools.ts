/**
 * AI TOOL LAYER — the only way MaxAI touches the trader's world.
 *
 * The rule the whole AI section stands on (docs/ai-architecture.md): the
 * model NEVER computes a number and NEVER executes anything. Every figure it
 * shows comes out of these executors — the same pricing engine the trading
 * path uses — and the one "action-shaped" tool, propose_order, returns a
 * proposal for the human to confirm in the UI. There is deliberately no
 * execute_order tool to prompt-inject.
 *
 * Every executor returns plain JSON (numbers raw, no formatting): rendering
 * is the client's job, and token-costly prose stays out of tool results.
 */

import Backtest from '../../models/Backtest';
import Bot from '../../models/Bot';
import Position from '../../models/Position';
import User from '../../models/User';
import { getSpec, normaliseVolume } from '../../config/instruments';
import { findAccount } from '../../controllers/liveTrade';
import {
    accountMetrics, getQuote, getSpreadPips, marginRequired, pipValue, unrealizedPnL,
} from '../pricing';
import { backtestPool } from '../backtest/pool';
import { backfillRange, coverage } from '../candles/backfill';
import { readBarsTf } from '../candles/store';
import { feedRouter } from '../feeds';
import { botRunner } from '../bots/runner';
import { createIndicator } from '../strategy/indicators';
import { validateSpec } from '../strategy/validate';
import { Bar, TIMEFRAMES, Timeframe } from '../strategy/types';
import { venueKindForAccount } from '../venues';
import { getTradeStats } from './statsRollup';

export interface AiTool {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (userId: string, args: any) => Promise<any>;
}

const MAX_CANDLES = 200;
const MAX_INDICATOR_VALUES = 50;
const MAX_BACKTEST_DAYS = 120;

const err = (message: string) => ({ error: message });

async function loadUser(userId: string): Promise<any | null> {
    return User.findById(userId);
}

/** Closed bars for a symbol/timeframe: the store first, the feeds second. */
async function loadBars(symbol: string, timeframe: Timeframe, limit: number): Promise<Bar[]> {
    const span = { '1m': 3, '5m': 3, '15m': 4, '30m': 5, '1h': 8, '4h': 30, '1d': 200, '1w': 700 }[timeframe] ?? 8;
    const now = Date.now();
    let bars = readBarsTf(symbol, timeframe, now - limit * span * 86_400_000 / (span > 5 ? span : 1), now);
    if (bars.length < Math.min(limit, 10)) {
        const fetched = await feedRouter.getCandles(symbol, timeframe, limit);
        if (fetched?.length) {
            bars = fetched.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
        }
    }
    return bars.slice(-limit);
}

export const AI_TOOLS: AiTool[] = [
    {
        name: 'get_account',
        description: 'Balance, equity, margin, free margin and margin level of one of the user\'s trading accounts. Default: their demo (simulation) account.',
        parameters: {
            type: 'object',
            properties: { accountId: { type: 'string', description: 'Optional account id; omit for the default demo account.' } },
        },
        async execute(userId, args) {
            const user = await loadUser(userId);
            if (!user) return err('User not found.');
            const account: any = findAccount(user, args?.accountId);
            if (!account) return err('No trading account connected.');
            const open = (await Position.find({ userId, status: 'OPEN', accountId: account.cTraderId }) as any[]);
            const kind = venueKindForAccount(account);
            const relevant = open.filter(p => kind === 'CTRADER' ? p.venue === 'CTRADER' : p.venue !== 'CTRADER');
            const m = accountMetrics(account.balance ?? 0, relevant as any);
            return {
                accountId: account.cTraderId,
                accountType: account.accountType,
                broker: account.broker ?? null,
                currency: account.currency ?? 'USD',
                balance: account.balance ?? 0,
                equity: m.equity,
                marginUsed: m.margin,
                freeMargin: m.freeMargin,
                marginLevelPct: m.marginLevel,
                openPositions: relevant.length,
                unpricedSymbols: m.unpriced,
            };
        },
    },
    {
        name: 'get_positions',
        description: 'The user\'s positions. status OPEN returns live unrealised P/L per position; CLOSED returns the most recent closed trades.',
        parameters: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['OPEN', 'CLOSED'] },
                limit: { type: 'number', description: 'Max rows, default 20.' },
            },
        },
        async execute(userId, args) {
            const status = args?.status === 'CLOSED' ? 'CLOSED' : 'OPEN';
            const limit = Math.min(50, Math.max(1, Number(args?.limit) || 20));
            const rows = (await Position.find({ userId, status }) as any[]);
            rows.sort((a, b) => new Date(b.closeTime ?? b.openTime ?? 0).getTime() - new Date(a.closeTime ?? a.openTime ?? 0).getTime());
            return rows.slice(0, limit).map(p => ({
                id: p.id ?? p._id,
                symbol: p.symbol,
                side: p.side,
                volume: p.volume,
                entryPrice: p.entryPrice,
                stopLoss: p.stopLoss ?? null,
                takeProfit: p.takeProfit ?? null,
                openTime: p.openTime,
                venue: p.venue ?? 'SIMULATED',
                botId: p.botId ?? null,
                ...(status === 'OPEN'
                    ? { unrealizedPnL: unrealizedPnL(p) ?? null }
                    : { closePrice: p.closePrice, closeTime: p.closeTime, netProfit: p.finalProfit ?? 0 }),
            }));
        },
    },
    {
        name: 'get_trade_stats',
        description: 'Aggregated trading record over the last N days (default 30): trades, win rate, net profit, profit factor, expectancy, and a per-day series. Reads the rollup — cheap, use freely.',
        parameters: {
            type: 'object',
            properties: {
                days: { type: 'number', description: '1–365, default 30.' },
                accountId: { type: 'string' },
            },
        },
        async execute(userId, args) {
            const days = Math.min(365, Math.max(1, Number(args?.days) || 30));
            return getTradeStats(userId, days, args?.accountId || undefined);
        },
    },
    {
        name: 'get_quote',
        description: 'Live bid/ask and spread for a symbol, e.g. "EUR/USD", "BTC/USDT", "GOLD".',
        parameters: {
            type: 'object',
            properties: { symbol: { type: 'string' } },
            required: ['symbol'],
        },
        async execute(_userId, args) {
            const symbol = String(args?.symbol ?? '');
            const q = getQuote(symbol);
            if (!q) return err(`No live quote for ${symbol}. It may not be streaming right now.`);
            return { symbol, bid: q.bid, ask: q.ask, mid: (q.bid + q.ask) / 2, spreadPips: getSpreadPips(symbol) ?? null, ts: q.ts };
        },
    },
    {
        name: 'get_candles',
        description: `Recent CLOSED candles for a symbol and timeframe (${TIMEFRAMES.join(', ')}). Max ${MAX_CANDLES}. Times are Unix ms.`,
        parameters: {
            type: 'object',
            properties: {
                symbol: { type: 'string' },
                timeframe: { type: 'string', enum: [...TIMEFRAMES] },
                limit: { type: 'number', description: `Default 100, max ${MAX_CANDLES}.` },
            },
            required: ['symbol', 'timeframe'],
        },
        async execute(_userId, args) {
            const timeframe = args?.timeframe as Timeframe;
            if (!TIMEFRAMES.includes(timeframe)) return err(`timeframe must be one of ${TIMEFRAMES.join(', ')}.`);
            const limit = Math.min(MAX_CANDLES, Math.max(1, Number(args?.limit) || 100));
            const bars = await loadBars(String(args?.symbol ?? ''), timeframe, limit);
            if (!bars.length) return err(`No candle data available for ${args?.symbol} ${timeframe}.`);
            return { symbol: args.symbol, timeframe, count: bars.length, bars };
        },
    },
    {
        name: 'get_indicator',
        description: 'Compute an indicator over recent closed candles and return its last values. Types: SMA, EMA, RSI, ATR, MACD, BBANDS, STOCH, HIGHEST, LOWEST. NEVER estimate an indicator yourself — call this.',
        parameters: {
            type: 'object',
            properties: {
                symbol: { type: 'string' },
                timeframe: { type: 'string', enum: [...TIMEFRAMES] },
                indicator: {
                    type: 'object',
                    description: 'e.g. {"type":"RSI","period":14} or {"type":"MACD","fast":12,"slow":26,"signal":9}',
                    properties: {
                        type: { type: 'string', enum: ['SMA', 'EMA', 'RSI', 'ATR', 'MACD', 'BBANDS', 'STOCH', 'HIGHEST', 'LOWEST'] },
                        period: { type: 'number' }, source: { type: 'string' },
                        fast: { type: 'number' }, slow: { type: 'number' }, signal: { type: 'number' },
                        mult: { type: 'number' }, kPeriod: { type: 'number' }, dPeriod: { type: 'number' },
                    },
                    required: ['type'],
                },
                count: { type: 'number', description: `Values to return, default 10, max ${MAX_INDICATOR_VALUES}.` },
            },
            required: ['symbol', 'timeframe', 'indicator'],
        },
        async execute(_userId, args) {
            const timeframe = args?.timeframe as Timeframe;
            if (!TIMEFRAMES.includes(timeframe)) return err(`timeframe must be one of ${TIMEFRAMES.join(', ')}.`);
            let incr;
            try {
                incr = createIndicator(args.indicator);
            } catch (e: any) {
                return err(`Invalid indicator: ${e.message}`);
            }
            const count = Math.min(MAX_INDICATOR_VALUES, Math.max(1, Number(args?.count) || 10));
            const warmup = Math.max(Number(args.indicator?.period) || 0, (Number(args.indicator?.slow) || 0) + (Number(args.indicator?.signal) || 0), 30);
            const bars = await loadBars(String(args?.symbol ?? ''), timeframe, count + warmup * 3);
            if (bars.length < warmup) return err(`Not enough candle history for ${args?.symbol} ${timeframe}.`);

            const fields: string[] = args.indicator.type === 'MACD' ? ['macd', 'signal', 'hist']
                : args.indicator.type === 'BBANDS' ? ['upper', 'middle', 'lower']
                : args.indicator.type === 'STOCH' ? ['k', 'd']
                : ['value'];
            const out: Array<Record<string, number>> = [];
            for (const bar of bars) {
                incr.update(bar);
                if (!incr.ready()) continue;
                const row: Record<string, number> = { time: bar.time, close: bar.close };
                for (const f of fields) row[f] = incr.value(f === 'value' ? undefined : f);
                out.push(row);
            }
            if (!out.length) return err('The indicator never became ready on the available history.');
            return { symbol: args.symbol, timeframe, indicator: args.indicator, values: out.slice(-count) };
        },
    },
    {
        name: 'run_backtest',
        description: `Backtest a StrategySpec over real stored history (max ${MAX_BACKTEST_DAYS} days) with real costs. Returns summary stats AND an honesty grade (A–F) — always report the grade next to the return. On validation failure returns { errors: [{path, message}] }: fix the spec and retry.`,
        parameters: {
            type: 'object',
            properties: {
                spec: { type: 'object', description: 'A full StrategySpec (name, symbol, timeframe, entry, exit.stopLoss required, sizing).' },
                days: { type: 'number', description: `Window in days, default 60, max ${MAX_BACKTEST_DAYS}.` },
            },
            required: ['spec'],
        },
        async execute(userId, args) {
            const check = validateSpec(args?.spec);
            if (!check.ok) return { errors: check.errors };
            const spec = check.spec!;
            const days = Math.min(MAX_BACKTEST_DAYS, Math.max(2, Number(args?.days) || 60));
            const toMs = Date.now();
            const fromMs = toMs - days * 86_400_000;

            if (coverage(spec.symbol, fromMs, toMs) < 0.5) {
                await backfillRange(spec.symbol, fromMs, toMs);
            }
            if (coverage(spec.symbol, fromMs, toMs) < 0.05) {
                return err(`Not enough history for ${spec.symbol} to backtest. Crypto and cTrader-covered symbols work best.`);
            }

            const row = await Backtest.create(userId, spec.name, spec, fromMs, toMs, null);
            try {
                const out = await backtestPool.run(userId, {
                    spec, fromMs, toMs, options: { startBalance: 10_000 },
                    candleRoot: process.env.CANDLE_DIR || undefined,
                });
                const s = out.result.stats;
                const summary = {
                    symbol: spec.symbol, timeframe: spec.timeframe,
                    startBalance: out.result.startBalance, endBalance: out.result.endBalance,
                    stats: s, grade: out.honesty.grade, honestyScore: out.honesty.score,
                    warnings: out.result.warnings,
                };
                await Backtest.finish(row.id, summary, {
                    trades: out.result.trades, equityCurve: out.result.equityCurve, honesty: out.honesty,
                });
                return {
                    backtestId: row.id,
                    grade: out.honesty.grade,
                    honestyScore: out.honesty.score,
                    honestyChecks: out.honesty.checks.map(c => ({ key: c.key, score: c.score, summary: c.summary })),
                    netProfit: s.netProfit, returnPct: s.returnPct, trades: s.trades,
                    winRate: s.winRate, profitFactor: s.profitFactor, expectancy: s.expectancy,
                    maxDrawdownPct: s.maxDrawdownPct,
                    totalCosts: { commission: s.totalCommission, swap: s.totalSwap, spread: s.totalSpreadCost },
                    warnings: out.result.warnings,
                };
            } catch (e: any) {
                await Backtest.fail(row.id, e?.message ?? 'Backtest failed.').catch(() => undefined);
                return err(e?.message ?? 'Backtest failed.');
            }
        },
    },
    {
        name: 'save_strategy',
        description: 'Save a validated StrategySpec as a bot on the user\'s demo account. On validation failure returns { errors: [{path, message}] }: fix and retry. Saving does NOT start it.',
        parameters: {
            type: 'object',
            properties: { spec: { type: 'object' } },
            required: ['spec'],
        },
        async execute(userId, args) {
            const check = validateSpec(args?.spec);
            if (!check.ok) return { errors: check.errors };
            const user = await loadUser(userId);
            if (!user) return err('User not found.');
            const account = findAccount(user, undefined);
            if (!account?.cTraderId) return err('No trading account to attach the bot to.');
            if (venueKindForAccount(account) === 'CTRADER') return err('Bots start on the simulated account; live comes only after a completed forward test.');
            const existing = await Bot.listByUser(userId);
            if (existing.length >= 20) return err('The user already has 20 bots — one must be deleted first.');
            const row = await Bot.create(userId, account.cTraderId, check.spec!.name, check.spec!);
            return { botId: row.id, name: row.name, status: row.status };
        },
    },
    {
        name: 'deploy_strategy',
        description: 'Start a saved bot in FORWARD TEST (paper trading on the demo account). This tool can never deploy to live — going live requires the user to pass the live gate in the app themselves.',
        parameters: {
            type: 'object',
            properties: { botId: { type: 'string' } },
            required: ['botId'],
        },
        async execute(userId, args) {
            const row = await Bot.findById(String(args?.botId ?? ''));
            if (!row || row.userId !== userId) return err('Bot not found.');
            if (row.status === 'LIVE') return err('The bot is LIVE; the AI cannot touch live deployments.');
            if (row.status === 'FORWARD_TEST') return { botId: row.id, status: row.status, note: 'Already running.' };
            try {
                await botRunner.register({ ...row, status: 'FORWARD_TEST' });
            } catch (e: any) {
                return err(`Spec no longer compiles: ${e.message}`);
            }
            await Bot.setStatus(row.id, 'FORWARD_TEST');
            return { botId: row.id, status: 'FORWARD_TEST' };
        },
    },
    {
        name: 'propose_order',
        description: 'Build a trade PROPOSAL with engine-computed margin, pip value and risk. It is NEVER executed — the user sees it as a card and decides. Use whenever the user asks for a setup or signal.',
        parameters: {
            type: 'object',
            properties: {
                symbol: { type: 'string' },
                side: { type: 'string', enum: ['BUY', 'SELL'] },
                volume: { type: 'number', description: 'Lots.' },
                stopLoss: { type: 'number' },
                takeProfit: { type: 'number' },
                rationale: { type: 'string', description: 'One or two sentences on why — shown to the user on the card.' },
            },
            required: ['symbol', 'side', 'volume', 'stopLoss', 'rationale'],
        },
        async execute(_userId, args) {
            const symbol = String(args?.symbol ?? '');
            const side = args?.side === 'SELL' ? 'SELL' : 'BUY';
            let spec;
            try {
                spec = getSpec(symbol);
            } catch (e: any) {
                return err(e.message);
            }
            const requested = Number(args?.volume) || 0;
            // Validate the RAW request: normalising first would silently
            // round 0.001 lots up to the minimum and change the user's risk.
            if (requested < spec.minVolume) return err(`Volume must be at least ${spec.minVolume} lots for ${symbol}.`);
            if (requested > spec.maxVolume) return err(`Volume must be at most ${spec.maxVolume} lots for ${symbol}.`);
            const volume = normaliseVolume(symbol, requested);

            const q = getQuote(symbol);
            const entry = q ? (side === 'BUY' ? q.ask : q.bid) : null;
            const sl = Number(args?.stopLoss);
            const tp = args?.takeProfit !== undefined && args?.takeProfit !== null ? Number(args.takeProfit) : null;
            if (entry !== null && Number.isFinite(sl)) {
                const wrongSide = side === 'BUY' ? sl >= entry : sl <= entry;
                if (wrongSide) return err(`stopLoss ${sl} is on the wrong side of the current ${side === 'BUY' ? 'ask' : 'bid'} ${entry}.`);
            }
            if (entry !== null && tp !== null) {
                const wrongSide = side === 'BUY' ? tp <= entry : tp >= entry;
                if (wrongSide) return err(`takeProfit ${tp} is on the wrong side of the current price ${entry}.`);
            }

            const perPip = pipValue(symbol, volume);
            const margin = marginRequired(symbol, volume);
            const riskMoney = entry !== null && perPip !== undefined && Number.isFinite(sl)
                ? Math.abs(entry - sl) / spec.pipSize * perPip
                : null;
            const rewardMoney = entry !== null && perPip !== undefined && tp !== null
                ? Math.abs(tp - entry) / spec.pipSize * perPip
                : null;

            return {
                proposal: {
                    symbol, side, volume,
                    estimatedEntry: entry,
                    stopLoss: Number.isFinite(sl) ? sl : null,
                    takeProfit: tp,
                    pipValue: perPip ?? null,
                    marginRequired: margin ?? null,
                    riskMoney,
                    rewardMoney,
                    rewardRiskRatio: riskMoney && rewardMoney ? rewardMoney / riskMoney : null,
                    rationale: String(args?.rationale ?? ''),
                    executed: false,
                    note: 'Proposal only. The user must confirm in the app to place it.',
                },
            };
        },
    },
];

/** OpenAI function-calling schema for the registry. */
export const toolSchemas = () => AI_TOOLS.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
}));

export async function executeTool(userId: string, name: string, rawArgs: string | undefined): Promise<any> {
    const tool = AI_TOOLS.find(t => t.name === name);
    if (!tool) return err(`Unknown tool ${name}.`);
    let args: any = {};
    if (rawArgs) {
        try {
            args = JSON.parse(rawArgs);
        } catch {
            return err('Tool arguments were not valid JSON.');
        }
    }
    try {
        return await tool.execute(userId, args);
    } catch (e: any) {
        return err(e?.message ?? 'Tool failed.');
    }
}
