/**
 * BOTS API — create, list, start, stop, delete.
 *
 * A bot is a validated StrategySpec; nothing unvalidated ever reaches the
 * database, so the runner can trust every stored row to compile. Bots trade
 * only in FORWARD_TEST (paper) until the live gate ships — that ordering is
 * the roadmap's rule 4, not an accident.
 */

import { Response } from 'express';
import Bot from '../models/Bot';
import Position from '../models/Position';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import Backtest from '../models/Backtest';
import BotEvent from '../models/BotEvent';
import { buildBotFromDescription } from '../services/ai/botBuilder';
import { consumeMessage, dailyLimitFor } from '../services/ai/quota';
import { describeSpec } from '../services/strategy/describe';
import { botRunner } from '../services/bots/runner';
import { evaluateLiveGate } from '../services/bots/liveGate';
import { computeTradeStats } from '../services/bots/tradeStats';
import { evaluateWatchdog, watchdogConfig } from '../services/bots/watchdog';
import { accountMetrics } from '../services/pricing';
import { validateSpec } from '../services/strategy/validate';
import { limitsFor, planOf } from '../services/plans';
import { venueKindForAccount } from '../services/venues';
import { findAccount } from './liveTrade';



export const createBot = async (req: AuthRequest, res: Response) => {
    try {
        const { spec, accountId } = req.body ?? {};

        const check = validateSpec(spec);
        if (!check.ok) {
            // Path-addressed errors: the AI authoring loop retries on exactly
            // this shape, and a human sees precisely which field is wrong.
            return res.status(400).json({ success: false, message: 'Invalid strategy spec', errors: check.errors });
        }

        const user = await User.findById(req.user!.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const account = findAccount(user, accountId);
        if (!account?.cTraderId) {
            return res.status(400).json({ success: false, message: 'No trading account to attach the bot to.' });
        }
        if (venueKindForAccount(account) === 'CTRADER') {
            return res.status(400).json({
                success: false,
                message: 'Bots run in forward test on a simulated account first. Live deployment opens after a completed forward test.',
            });
        }

        const existing = await Bot.listByUser(req.user!.id);
        const maxBots = limitsFor(user).maxBots;
        if (existing.length >= maxBots) {
            return res.status(400).json({
                success: false,
                message: `Your ${planOf(user)} plan allows ${maxBots} bots. Delete one, or upgrade for more.`,
                paywall: planOf(user) === 'FREE',
            });
        }

        const row = await Bot.create(req.user!.id, account.cTraderId, check.spec!.name, check.spec!);
        res.status(200).json({ success: true, data: row });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const listBots = async (req: AuthRequest, res: Response) => {
    try {
        const rows = await Bot.listByUser(req.user!.id);

        // Attach each bot's paper record so the list is a scoreboard, not
        // just names: trades, net P/L, open position.
        const withStats = await Promise.all(rows.map(async row => {
            let trades = 0;
            let netProfit = 0;
            let openPosition: any = null;
            try {
                const positions = await Position.find({ userId: req.user!.id });
                for (const p of positions as any[]) {
                    if (p.botId !== row.id) continue;
                    if (p.status === 'CLOSED') {
                        trades++;
                        netProfit += p.finalProfit ?? 0;
                    } else if (p.status === 'OPEN') {
                        openPosition = { id: p.id, side: p.side, symbol: p.symbol, entryPrice: p.entryPrice };
                    }
                }
            } catch { /* stats are best-effort */ }
            return { ...row, stats: { trades, netProfit: Number(netProfit.toFixed(2)), openPosition } };
        }));

        res.status(200).json({ success: true, data: withStats });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const startBot = async (req: AuthRequest, res: Response) => {
    try {
        const row = await Bot.findById(String(req.params.id));
        if (!row || row.userId !== req.user!.id) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        if (row.status === 'FORWARD_TEST') {
            return res.status(200).json({ success: true, message: 'Already running', data: row });
        }
        if (row.status === 'LIVE') {
            return res.status(400).json({ success: false, message: 'The bot is LIVE. Stop it first if you want to demote it to forward test.' });
        }

        // Compile before flipping status, so a spec that stopped validating
        // (e.g. after a grammar tightening) fails here with the reasons.
        try {
            await botRunner.register({ ...row, status: 'FORWARD_TEST' });
        } catch (e: any) {
            return res.status(400).json({ success: false, message: e.message });
        }
        await Bot.setStatus(row.id, 'FORWARD_TEST');

        res.status(200).json({ success: true, message: 'Forward test started', data: { ...row, status: 'FORWARD_TEST' } });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const stopBot = async (req: AuthRequest, res: Response) => {
    try {
        const row = await Bot.findById(String(req.params.id));
        if (!row || row.userId !== req.user!.id) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        botRunner.unregister(row.id);
        await Bot.setStatus(row.id, 'STOPPED');
        // The bot's open position (if any) is left to its SL/TP on purpose:
        // stopping a bot stops NEW decisions; it does not yank an open trade.
        // Closing it is one tap away in the positions screen.
        res.status(200).json({ success: true, message: 'Bot stopped', data: { ...row, status: 'STOPPED' } });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const deleteBot = async (req: AuthRequest, res: Response) => {
    try {
        const row = await Bot.findById(String(req.params.id));
        if (!row || row.userId !== req.user!.id) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        if (row.status !== 'STOPPED') {
            return res.status(400).json({ success: false, message: 'Stop the bot before deleting it.' });
        }
        botRunner.unregister(row.id);
        await Bot.remove(row.id, req.user!.id);
        res.status(200).json({ success: true, message: 'Bot deleted' });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/**
 * FORWARD-TEST REPORT — the bot's live record, next to three yardsticks:
 * its own backtest (the "reality gap"), the user's manual trading over the
 * same period ("bot vs you"), and the live gate's verdict.
 */
export const getBotReport = async (req: AuthRequest, res: Response) => {
    try {
        const row = await Bot.findById(String(req.params.id));
        if (!row || row.userId !== req.user!.id) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }

        const all = await Position.find({ userId: req.user!.id }) as any[];
        const closed = all.filter(p => p.status === 'CLOSED');
        const botTrades = closed.filter(p => p.botId === row.id);
        const forward = computeTradeStats(botTrades);
        const gate = evaluateLiveGate(row, forward);

        // "Bot vs you": the user's own manual closed trades since the bot
        // started — same stats formulas, honestly comparable columns.
        const sinceMs = row.startedAt?.getTime() ?? forward.firstTradeAt ?? 0;
        const manualTrades = closed.filter(p =>
            !p.botId && p.closeTime && new Date(p.closeTime).getTime() >= sinceMs);
        const you = computeTradeStats(manualTrades);

        // Reality gap: forward expectancy vs the most recent completed
        // backtest of this bot. A big gap means the backtest flattered.
        let backtest: any = null;
        try {
            const tests = await Backtest.listByUser(req.user!.id);
            const mine = tests.find(t => t.botId === row.id && t.status === 'DONE' && t.summary?.stats);
            if (mine) {
                const bs = mine.summary.stats;
                backtest = {
                    id: mine.id,
                    finishedAt: mine.finishedAt,
                    grade: mine.summary.grade ?? null,
                    expectancy: bs.expectancy ?? null,
                    winRate: bs.winRate ?? null,
                    profitFactor: bs.profitFactor ?? null,
                    realityGap: (typeof bs.expectancy === 'number' && bs.expectancy > 0 && forward.trades >= 5)
                        ? Number((forward.expectancy / bs.expectancy).toFixed(2))
                        : null,
                };
            }
        } catch { /* comparison is best-effort */ }

        // Watchdog: its live readings, plus the events it has recorded.
        let watchdog: any = null;
        try {
            const user2 = await User.findById(req.user!.id);
            const account = user2?.cTraderAccounts?.find((a: any) => a.cTraderId === row.accountId);
            const openRows = all.filter(p => p.status === 'OPEN' && p.accountId === row.accountId
                && (row.status === 'LIVE' ? p.venue === 'CTRADER' : p.venue !== 'CTRADER'));
            const equity = accountMetrics(account?.balance ?? 0, openRows as any).equity;
            const verdict = evaluateWatchdog(row.watchdog, botTrades, equity);
            watchdog = { config: row.watchdog, verdict, events: await BotEvent.listByBot(row.id, 10).catch(() => []) };
        } catch { /* the report survives without it */ }

        res.status(200).json({
            success: true,
            data: {
                bot: { id: row.id, name: row.name, status: row.status, symbol: row.spec.symbol, startedAt: row.startedAt, liveStartedAt: row.liveStartedAt, liveVolumeMode: row.liveVolumeMode },
                rules: describeSpec(row.spec, 'fa'),
                watchdog,
                forward,
                openPosition: (() => {
                    const p = all.find(q => q.botId === row.id && q.status === 'OPEN');
                    return p ? { id: p.id, side: p.side, symbol: p.symbol, entryPrice: p.entryPrice, volume: p.volume } : null;
                })(),
                gate,
                backtest,
                you: { ...you, note: 'Your manual closed trades over the same period.' },
            },
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/**
 * GO LIVE — the only door from paper to real money, and the gate is in it.
 * Requires a completed forward test, a real CTRADER account, and (when the
 * forward record is losing) an explicit acknowledgement. Live sizing
 * defaults to the instrument's minimum volume; trusting the spec's sizing
 * is an explicit opt-in.
 */
export const goLiveBot = async (req: AuthRequest, res: Response) => {
    try {
        const row = await Bot.findById(String(req.params.id));
        if (!row || row.userId !== req.user!.id) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        if (row.status === 'LIVE') {
            return res.status(400).json({ success: false, message: 'The bot is already live.' });
        }

        const { accountId, volumeMode, acknowledgeLosingRecord } = req.body ?? {};
        const user = await User.findById(req.user!.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        const account = findAccount(user, accountId);
        if (!account?.cTraderId) {
            return res.status(400).json({ success: false, message: 'accountId of a connected cTrader account is required.' });
        }
        if (venueKindForAccount(account) !== 'CTRADER') {
            return res.status(400).json({ success: false, message: 'Live deployment needs a real cTrader account, not a simulated one.' });
        }

        const closed = (await Position.find({ userId: req.user!.id }) as any[])
            .filter(p => p.status === 'CLOSED' && p.botId === row.id);
        const gate = evaluateLiveGate(row, computeTradeStats(closed));
        if (!gate.eligible) {
            return res.status(400).json({
                success: false,
                message: 'The live gate is closed: complete the forward test first.',
                gate,
            });
        }
        if (gate.losingRecord && acknowledgeLosingRecord !== true) {
            return res.status(400).json({
                success: false,
                message: 'This bot LOST money in its forward test. To deploy it live anyway, resend with acknowledgeLosingRecord: true.',
                gate,
            });
        }

        const mode: 'MIN' | 'SPEC' = volumeMode === 'SPEC' ? 'SPEC' : 'MIN';

        // Re-register on the live account before flipping the row, so a spec
        // that stopped compiling fails here, visibly, not at 3am on a signal.
        botRunner.unregister(row.id);
        await Bot.goLive(row.id, account.cTraderId, mode);
        const liveRow = await Bot.findById(row.id);
        try {
            await botRunner.register(liveRow!);
        } catch (e: any) {
            await Bot.setStatus(row.id, 'STOPPED');
            return res.status(400).json({ success: false, message: `Spec no longer compiles: ${e.message}` });
        }

        res.status(200).json({
            success: true,
            message: mode === 'MIN'
                ? 'Bot is LIVE at minimum volume. Volume follows the spec only after you opt in with volumeMode: SPEC.'
                : 'Bot is LIVE with the spec\'s own sizing.',
            data: liveRow,
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/**
 * NATURAL-LANGUAGE BUILDER — the phase-6 loop as one endpoint.
 *
 * Persian/English description in; validated spec + deterministic Persian
 * rule sheet + real backtest with honesty grade out. Costs one AI-quota
 * message per call (the retries inside are part of that one message). The
 * client's ONLY action button on the result is "start forward test" — this
 * endpoint saves nothing by itself unless save=true is passed with a clean
 * build.
 */
export const buildBot = async (req: AuthRequest, res: Response) => {
    try {
        const { description, days, save } = req.body ?? {};
        if (!description || typeof description !== 'string' || description.trim().length < 10) {
            return res.status(400).json({ success: false, message: 'Describe the strategy in at least a sentence.' });
        }

        const user = await User.findById(req.user!.id);
        const quota = await consumeMessage(req.user!.id, dailyLimitFor(user));
        if (!quota.allowed) {
            return res.status(429).json({
                success: false, paywall: true,
                message: 'Daily AI message limit reached',
                usage: { used: quota.used, limit: quota.limit },
            });
        }

        const result = await buildBotFromDescription(req.user!.id, description.trim(), { days });
        if (!result.ok) {
            return res.status(422).json({
                success: false,
                message: 'Could not produce a valid strategy from that description.',
                attempts: result.attempts,
                errors: result.errors,
            });
        }

        let botId: string | null = null;
        if (save === true) {
            const account = findAccount(user, undefined);
            if (account?.cTraderId && venueKindForAccount(account) !== 'CTRADER') {
                const existing = await Bot.listByUser(req.user!.id);
                if (existing.length < limitsFor(user).maxBots) {
                    const row = await Bot.create(req.user!.id, account.cTraderId, result.spec!.name, result.spec!, 'AI');
                    botId = row.id;
                }
            }
        }

        res.status(200).json({
            success: true,
            data: {
                spec: result.spec,
                rules: result.rules,
                backtest: result.backtest,
                attempts: result.attempts,
                botId,
            },
            usage: { used: quota.used, limit: quota.limit },
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/**
 * CHART FEED — everything the chart needs to draw a bot's activity:
 * its closed trades (entry/exit anchors), the live position's levels
 * (entry/SL/TP lines), and the spec's indicators.
 */
export const getBotChart = async (req: AuthRequest, res: Response) => {
    try {
        const row = await Bot.findById(String(req.params.id));
        if (!row || row.userId !== req.user!.id) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        const all = (await Position.find({ userId: req.user!.id }) as any[]).filter(p => p.botId === row.id);

        const trades = all
            .filter(p => p.status === 'CLOSED' && p.closeTime)
            .map(p => ({
                side: p.side,
                volume: p.volume,
                entryTime: p.openTime ? new Date(p.openTime).getTime() : null,
                entryPrice: p.entryPrice,
                exitTime: new Date(p.closeTime).getTime(),
                exitPrice: p.closePrice,
                netProfit: p.finalProfit ?? 0,
            }))
            .filter(t => t.entryTime && Number.isFinite(t.entryPrice) && Number.isFinite(t.exitPrice));

        const openRow = all.find(p => p.status === 'OPEN');
        const open = openRow ? {
            side: openRow.side,
            volume: openRow.volume,
            entryPrice: openRow.entryPrice,
            stopLoss: openRow.stopLoss ?? null,
            takeProfit: openRow.takeProfit ?? null,
            openTime: openRow.openTime ? new Date(openRow.openTime).getTime() : null,
        } : null;

        res.status(200).json({
            success: true,
            data: {
                botId: row.id,
                name: row.name,
                symbol: row.spec.symbol,
                timeframe: row.spec.timeframe,
                indicators: Object.entries(row.spec.indicators ?? {}).map(([name, def]) => ({ name, def })),
                trades,
                open,
            },
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/**
 * EXPORT / IMPORT — a bot as a portable file.
 *
 * The file is the spec plus metadata, nothing else: no run state, no
 * account ids, no credentials. Import runs the FULL validator — a file is
 * just another untrusted spec source, exactly like the AI's output.
 */
export const exportBot = async (req: AuthRequest, res: Response) => {
    try {
        const row = await Bot.findById(String(req.params.id));
        if (!row || row.userId !== req.user!.id) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        const payload = {
            format: 'termax-bot',
            version: 1,
            name: row.name,
            spec: row.spec,
            exportedAt: new Date().toISOString(),
        };
        const filename = `${row.name.replace(/[^A-Za-z0-9\u0600-\u06FF_-]+/g, '_').slice(0, 40) || 'bot'}.termax-bot.json`;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.status(200).send(JSON.stringify(payload, null, 2));
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const importBot = async (req: AuthRequest, res: Response) => {
    try {
        let payload = req.body?.payload ?? req.body;
        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch {
                return res.status(400).json({ success: false, message: 'The file is not valid JSON.' });
            }
        }
        // Accept the wrapped export format or a bare spec.
        const rawSpec = payload?.format === 'termax-bot' ? payload.spec : payload?.spec ?? payload;
        const check = validateSpec(rawSpec);
        if (!check.ok) {
            return res.status(400).json({ success: false, message: 'Invalid strategy spec in the file', errors: check.errors });
        }

        const user = await User.findById(req.user!.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        const account = findAccount(user, undefined);
        if (!account?.cTraderId || venueKindForAccount(account) === 'CTRADER') {
            return res.status(400).json({ success: false, message: 'Importing needs a simulated account to attach the bot to.' });
        }
        const existing = await Bot.listByUser(req.user!.id);
        const maxBots = limitsFor(user).maxBots;
        if (existing.length >= maxBots) {
            return res.status(400).json({
                success: false,
                message: `Your ${planOf(user)} plan allows ${maxBots} bots. Delete one, or upgrade for more.`,
                paywall: planOf(user) === 'FREE',
            });
        }

        const name = (typeof payload?.name === 'string' && payload.name.trim() ? payload.name.trim() : check.spec!.name).slice(0, 60);
        const row = await Bot.create(req.user!.id, account.cTraderId, name, check.spec!, 'IMPORT');
        res.status(200).json({
            success: true,
            message: 'Imported. It starts STOPPED — backtest and forward test it yourself before trusting it.',
            data: row,
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/**
 * WATCHDOG SETTINGS — read and write, including the master on/off switch.
 * Turning it off is explicit and instant; nothing about it is hidden.
 */
export const getWatchdog = async (req: AuthRequest, res: Response) => {
    try {
        const row = await Bot.findById(String(req.params.id));
        if (!row || row.userId !== req.user!.id) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        const closed = (await Position.find({ userId: req.user!.id, status: 'CLOSED' }) as any[])
            .filter(p => p.botId === row.id);
        const user = await User.findById(req.user!.id);
        const account = user?.cTraderAccounts?.find((a: any) => a.cTraderId === row.accountId);
        const open = (await Position.find({ userId: req.user!.id, status: 'OPEN', accountId: row.accountId }) as any[])
            .filter(p => row.status === 'LIVE' ? p.venue === 'CTRADER' : p.venue !== 'CTRADER');
        const equity = accountMetrics(account?.balance ?? 0, open as any).equity;

        res.status(200).json({
            success: true,
            data: {
                config: row.watchdog,
                verdict: evaluateWatchdog(row.watchdog, closed, equity),
                events: await BotEvent.listByBot(row.id, 20).catch(() => []),
            },
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const updateWatchdog = async (req: AuthRequest, res: Response) => {
    try {
        const row = await Bot.findById(String(req.params.id));
        if (!row || row.userId !== req.user!.id) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        // Merge over what is stored, so a client can PATCH just the switch.
        const next = watchdogConfig({ ...row.watchdog, ...(req.body ?? {}) });
        await Bot.saveWatchdog(row.id, next);

        // A change this consequential belongs in the audit trail.
        const changedEnabled = next.enabled !== row.watchdog.enabled;
        if (changedEnabled) {
            await BotEvent.record(req.user!.id, row.id, {
                kind: next.enabled ? 'watchdog:enabled' : 'watchdog:disabled',
                severity: next.enabled ? 'INFO' : 'WARN',
                messageFa: next.enabled
                    ? 'نگهبان روشن شد.'
                    : 'نگهبان خاموش شد — از این پس هیچ سقف ضرری ربات را متوقف نمی‌کند.',
                messageEn: next.enabled
                    ? 'The watchdog was switched on.'
                    : 'The watchdog was switched off — no loss limit will stop this bot from now on.',
                evidence: { ...next },
            }).catch(() => undefined);
        }

        // The runner reads the row it holds, so refresh its copy.
        botRunner.refreshWatchdog(row.id, next);

        res.status(200).json({ success: true, data: { config: next } });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/** Every watchdog/bot event for this user — the studio's activity feed. */
export const listBotEvents = async (req: AuthRequest, res: Response) => {
    try {
        const rows = await BotEvent.listByUser(req.user!.id, 40);
        res.status(200).json({ success: true, data: rows });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};
