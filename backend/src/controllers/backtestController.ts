/**
 * BACKTESTS API — request, list, inspect, delete.
 *
 * A backtest request answers immediately with a RUNNING row; the actual run
 * happens off the request path (backfill on the main thread's I/O, the CPU
 * work inside the worker pool) and the row flips to DONE/FAILED when it
 * lands. Results always carry the honesty grade next to the return — the
 * grade is not optional decoration, it is the product.
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Backtest from '../models/Backtest';
import Bot from '../models/Bot';
import { getSpec as instrumentSpec } from '../config/instruments';
import { rateToAccount } from '../services/pricing';
import { backfillRange, coverage, MAX_BACKFILL_DAYS } from '../services/candles/backfill';
import { backtestPool } from '../services/backtest/pool';
import { validateSpec } from '../services/strategy/validate';
import { StrategySpec } from '../services/strategy/types';

const MAX_STORED_PER_USER = 100;
const DEFAULT_DAYS = 90;
const MIN_DAYS = 2;

export const createBacktest = async (req: AuthRequest, res: Response) => {
    try {
        const { spec: rawSpec, botId, days, startBalance } = req.body ?? {};

        // Spec comes inline or from a saved bot — always re-validated here,
        // never trusted because it was valid once.
        let spec: StrategySpec;
        let linkedBotId: string | null = null;
        if (botId) {
            const bot = await Bot.findById(String(botId));
            if (!bot || bot.userId !== req.user!.id) {
                return res.status(404).json({ success: false, message: 'Bot not found' });
            }
            spec = bot.spec;
            linkedBotId = bot.id;
        } else {
            const check = validateSpec(rawSpec);
            if (!check.ok) {
                return res.status(400).json({ success: false, message: 'Invalid strategy spec', errors: check.errors });
            }
            spec = check.spec!;
        }

        const windowDays = Math.min(MAX_BACKFILL_DAYS, Math.max(MIN_DAYS, Number(days) || DEFAULT_DAYS));
        const toMs = Date.now();
        const fromMs = toMs - windowDays * 86_400_000;
        const balance = Number(startBalance) > 0 ? Number(startBalance) : 10_000;

        if (backtestPool.load(req.user!.id) >= 2) {
            return res.status(429).json({ success: false, message: 'You already have 2 backtests in flight — wait for one to finish.' });
        }
        const stored = await Backtest.countByUser(req.user!.id);
        if (stored >= MAX_STORED_PER_USER) {
            return res.status(400).json({ success: false, message: `You have ${stored} stored backtests. Delete some before running more.` });
        }

        const row = await Backtest.create(req.user!.id, spec.name, spec, fromMs, toMs, linkedBotId);
        res.status(200).json({ success: true, data: { id: row.id, status: row.status, from: fromMs, to: toMs } });

        // The response is gone; everything from here lands in the row.
        void runJob(row.id, req.user!.id, spec, fromMs, toMs, balance);
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

async function runJob(rowId: string, userId: string, spec: StrategySpec, fromMs: number, toMs: number, startBalance: number) {
    try {
        // Fill the store's gaps for this window before dispatching the CPU
        // work. Feeds are I/O — this belongs on the main thread.
        let cov = coverage(spec.symbol, fromMs, toMs);
        if (cov < 0.5) {
            const filled = await backfillRange(spec.symbol, fromMs, toMs);
            cov = coverage(spec.symbol, fromMs, toMs);
            if (filled.noSource && cov < 0.05) {
                await Backtest.fail(rowId, `No feed has historical data for ${spec.symbol}. Crypto and cTrader-covered symbols can be backtested; this one has no history source.`);
                return;
            }
        }
        if (cov < 0.05) {
            await Backtest.fail(rowId, `Not enough history for ${spec.symbol} in this window (coverage ${(cov * 100).toFixed(1)}%). Try a shorter range, or wait for backfill to accumulate.`);
            return;
        }

        // Static conversion rate for cross pairs, from today's quotes — the
        // engine flags the approximation in the result's warnings.
        const inst = instrumentSpec(spec.symbol);
        const conversionRates: Record<string, number> = {};
        if (inst.quote !== 'USD' && inst.base !== 'USD') {
            const r = rateToAccount(inst.quote);
            if (r !== undefined) conversionRates[inst.quote] = r;
        }

        const out = await backtestPool.run(userId, {
            spec, fromMs, toMs,
            options: { startBalance, conversionRates },
            candleRoot: process.env.CANDLE_DIR || undefined,
        });

        const summary = {
            symbol: out.result.symbol,
            timeframe: out.result.timeframe,
            startBalance: out.result.startBalance,
            endBalance: out.result.endBalance,
            stats: out.result.stats,
            grade: out.honesty.grade,
            honestyScore: out.honesty.score,
            warnings: out.result.warnings,
            coverage: Number(cov.toFixed(3)),
        };
        await Backtest.finish(rowId, summary, {
            trades: out.result.trades,
            equityCurve: out.result.equityCurve,
            honesty: out.honesty,
        });
    } catch (e: any) {
        try {
            await Backtest.fail(rowId, e?.message ?? 'Backtest failed.');
        } catch { /* row update failed; nothing left to report to */ }
    }
}

export const listBacktests = async (req: AuthRequest, res: Response) => {
    try {
        const rows = await Backtest.listByUser(req.user!.id);
        res.status(200).json({ success: true, data: rows });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const getBacktest = async (req: AuthRequest, res: Response) => {
    try {
        const row = await Backtest.findById(String(req.params.id));
        if (!row || row.userId !== req.user!.id) {
            return res.status(404).json({ success: false, message: 'Backtest not found' });
        }
        res.status(200).json({ success: true, data: row });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const deleteBacktest = async (req: AuthRequest, res: Response) => {
    try {
        const removed = await Backtest.remove(String(req.params.id), req.user!.id);
        if (!removed) return res.status(404).json({ success: false, message: 'Backtest not found' });
        res.status(200).json({ success: true, message: 'Backtest deleted' });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};
