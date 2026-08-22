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
import { botRunner } from '../services/bots/runner';
import { validateSpec } from '../services/strategy/validate';
import { venueKindForAccount } from '../services/venues';
import { findAccount } from './liveTrade';

const MAX_BOTS_PER_USER = 20;

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
        if (existing.length >= MAX_BOTS_PER_USER) {
            return res.status(400).json({ success: false, message: `You can keep at most ${MAX_BOTS_PER_USER} bots. Delete one first.` });
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
        if (row.status === 'FORWARD_TEST') {
            return res.status(400).json({ success: false, message: 'Stop the bot before deleting it.' });
        }
        botRunner.unregister(row.id);
        await Bot.remove(row.id, req.user!.id);
        res.status(200).json({ success: true, message: 'Bot deleted' });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};
