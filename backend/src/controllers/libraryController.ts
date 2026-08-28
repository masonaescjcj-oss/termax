/**
 * STRATEGY LIBRARY — publish, browse, clone.
 *
 * The library's one non-negotiable: the record next to every strategy is
 * its FORWARD-TEST record, recomputed from real closed trades — never a
 * backtest. Publishing itself is gated exactly like going live: a bot
 * must have completed the forward-test thresholds before it can stand on
 * the leaderboard. A library of curve-fit backtests would be a casino
 * brochure; this one is a scoreboard.
 */

import { Response } from 'express';
import Bot from '../models/Bot';
import Position from '../models/Position';
import PublishedStrategy, { PublishedRow } from '../models/PublishedStrategy';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../middleware/auth';
import { evaluateLiveGate } from '../services/bots/liveGate';
import { computeTradeStats, TradeStats } from '../services/bots/tradeStats';
import { limitsFor, planOf } from '../services/plans';
import { describeSpec } from '../services/strategy/describe';
import User from '../models/User';
import { findAccount } from './liveTrade';
import { venueKindForAccount } from '../services/venues';

const STATS_TTL_MS = 10 * 60_000;
const statsCache = new Map<string, { at: number; stats: TradeStats; username: string }>();

/** Live forward record of one published row, cached briefly. */
async function forwardRecordOf(row: PublishedRow): Promise<{ stats: TradeStats; username: string }> {
    const cached = statsCache.get(row.id);
    if (cached && Date.now() - cached.at < STATS_TTL_MS) return cached;

    const positions = (await Position.find({ userId: row.userId, status: 'CLOSED' }) as any[])
        .filter(p => p.botId === row.botId);
    const stats = computeTradeStats(positions);

    let username = 'trader';
    try {
        const { data } = await supabase.from('users').select('username').eq('id', row.userId).maybeSingle();
        if (data?.username) username = data.username;
    } catch { /* leaderboard survives a name lookup failure */ }

    const entry = { at: Date.now(), stats, username };
    statsCache.set(row.id, entry);
    return entry;
}

export const publishStrategy = async (req: AuthRequest, res: Response) => {
    try {
        const { botId, title, description } = req.body ?? {};
        const bot = await Bot.findById(String(botId ?? ''));
        if (!bot || bot.userId !== req.user!.id) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }

        // Same thresholds as the live gate: a completed forward test.
        const closed = (await Position.find({ userId: req.user!.id, status: 'CLOSED' }) as any[])
            .filter(p => p.botId === bot.id);
        const gate = evaluateLiveGate({ ...bot, status: 'STOPPED' }, computeTradeStats(closed));
        if (!gate.eligible) {
            return res.status(400).json({
                success: false,
                message: 'Publishing needs a COMPLETED forward test — the library shows live records, not promises.',
                gate,
            });
        }

        const row = await PublishedStrategy.publish(
            req.user!.id,
            bot.id,
            (typeof title === 'string' && title.trim().length >= 3 ? title.trim().slice(0, 60) : bot.name),
            typeof description === 'string' ? description.trim().slice(0, 500) : null,
            bot.spec,
        );
        statsCache.delete(row.id);
        res.status(200).json({ success: true, data: row });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const listLibrary = async (req: AuthRequest, res: Response) => {
    try {
        const rows = await PublishedStrategy.listActive();
        const enriched = await Promise.all(rows.map(async row => {
            const { stats, username } = await forwardRecordOf(row);
            return {
                id: row.id,
                title: row.title,
                description: row.description,
                author: username,
                mine: row.userId === req.user!.id,
                symbol: row.spec.symbol,
                timeframe: row.spec.timeframe,
                rules: describeSpec(row.spec, 'en'),
                clones: row.clones,
                publishedAt: row.publishedAt,
                forward: stats,
            };
        }));
        // Leaderboard order: net forward profit. The client re-sorts freely.
        enriched.sort((a, b) => (b.forward.netProfit ?? 0) - (a.forward.netProfit ?? 0));
        res.status(200).json({ success: true, data: enriched });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const cloneStrategy = async (req: AuthRequest, res: Response) => {
    try {
        const row = await PublishedStrategy.findById(String(req.params.id));
        if (!row || !row.isActive) {
            return res.status(404).json({ success: false, message: 'Strategy not found' });
        }
        const user = await User.findById(req.user!.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        const account = findAccount(user, undefined);
        if (!account?.cTraderId || venueKindForAccount(account) === 'CTRADER') {
            return res.status(400).json({ success: false, message: 'Cloning needs a simulated account to attach the bot to.' });
        }
        const existing = await Bot.listByUser(req.user!.id);
        const cap = limitsFor(user).maxBots;
        if (existing.length >= cap) {
            return res.status(400).json({
                success: false,
                message: `Your ${planOf(user)} plan allows ${cap} bots. Delete one, or upgrade for more.`,
                paywall: planOf(user) === 'FREE',
            });
        }

        const name = `${row.title}`.slice(0, 60);
        const bot = await Bot.create(req.user!.id, account.cTraderId, name, row.spec, 'CLONE');
        await PublishedStrategy.bumpClones(row.id);
        res.status(200).json({
            success: true,
            message: 'Cloned. It starts STOPPED — run your own forward test; the author\'s record is theirs, not yours.',
            data: bot,
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const unpublishStrategy = async (req: AuthRequest, res: Response) => {
    try {
        const removed = await PublishedStrategy.unpublish(String(req.params.id), req.user!.id);
        if (!removed) return res.status(404).json({ success: false, message: 'Strategy not found' });
        res.status(200).json({ success: true, message: 'Unpublished' });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};
