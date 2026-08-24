/**
 * INSIGHTS API — Trade DNA, trade autopsy, and pre-trade warnings.
 *
 * All three are deterministic reads over the user's own record: no AI
 * tokens, no invented numbers. The pre-trade check is the "alert with a
 * reason" the roadmap asks for — it fires only when the user's OWN history
 * says this exact context has hurt them before, and it says why.
 */

import { Response } from 'express';
import Position from '../models/Position';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { accountMetrics, getSpreadPips } from '../services/pricing';
import { evaluateRiskGuard, riskGuardConfig } from '../services/riskGuard';
import { computeTradeDna, DnaProfile, DnaTrade } from '../services/insights/tradeDna';
import { classifyContext, sliceByContext } from '../services/insights/journal';
import { runAutopsy } from '../services/insights/autopsy';
import { buildWeeklyDigest } from '../services/insights/digest';
import Bot from '../models/Bot';
import BotEvent from '../models/BotEvent';
import { computeTradeStats } from '../services/bots/tradeStats';
import { getTradeStats } from '../services/ai/statsRollup';

const DNA_TTL_MS = 10 * 60_000;
const dnaCache = new Map<string, { profile: DnaProfile; at: number }>();

/** Manual (non-bot) closed trades, shaped for the DNA engine. */
async function loadManualClosedTrades(userId: string): Promise<DnaTrade[]> {
    const rows = (await Position.find({ userId, status: 'CLOSED' }) as any[]);
    return rows
        .filter(p => !p.botId && p.openTime && p.closeTime)
        .map(p => ({
            symbol: p.symbol,
            side: p.side,
            volume: Number(p.volume) || 0,
            netProfit: Number(p.finalProfit) || 0,
            openTime: new Date(p.openTime).getTime(),
            closeTime: new Date(p.closeTime).getTime(),
        }));
}

async function dnaFor(userId: string): Promise<DnaProfile> {
    const cached = dnaCache.get(userId);
    if (cached && Date.now() - cached.at < DNA_TTL_MS) return cached.profile;
    const profile = computeTradeDna(await loadManualClosedTrades(userId));
    dnaCache.set(userId, { profile, at: Date.now() });
    return profile;
}

export const getTradeDna = async (req: AuthRequest, res: Response) => {
    try {
        const profile = await dnaFor(req.user!.id);

        // Auto journal: tag each trade with the regime it happened in and
        // slice the record by it. Capped at the 200 most recent trades —
        // each tag reads candles, and the tail adds nothing a trader can
        // act on today.
        let context: any = null;
        try {
            const trades = (await loadManualClosedTrades(req.user!.id))
                .sort((a, b) => b.closeTime - a.closeTime)
                .slice(0, 200);
            const tagged = trades.map(t => ({
                tags: classifyContext({ symbol: t.symbol, side: t.side, openTime: t.openTime, closeTime: t.closeTime }),
                netProfit: t.netProfit,
            }));
            const usable = tagged.filter(t => t.tags.evidence.bars >= 60);
            context = {
                tagged: usable.length,
                skipped: tagged.length - usable.length,
                slices: sliceByContext(usable),
            };
        } catch (e: any) {
            console.warn('[Journal] context slicing failed:', e.message);
        }

        res.status(200).json({ success: true, data: { ...profile, context } });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const getTradeAutopsy = async (req: AuthRequest, res: Response) => {
    try {
        const rows = (await Position.find({ userId: req.user!.id, status: 'CLOSED' }) as any[]);
        const p = rows.find(r => String(r.id ?? r._id) === String(req.params.positionId));
        if (!p) return res.status(404).json({ success: false, message: 'Closed trade not found' });

        const report = runAutopsy({
            symbol: p.symbol,
            side: p.side,
            volume: Number(p.volume) || 0,
            entryPrice: Number(p.entryPrice),
            closePrice: Number(p.closePrice),
            openTime: new Date(p.openTime).getTime(),
            closeTime: new Date(p.closeTime).getTime(),
            netProfit: Number(p.finalProfit) || 0,
            stopLoss: p.stopLoss ?? null,
            takeProfit: p.takeProfit ?? null,
            commission: p.commission ?? null,
            swap: p.swap ?? null,
        });
        if (!report.ok) return res.status(422).json({ success: false, message: report.reason });

        let context: any = null;
        try {
            context = classifyContext({
                symbol: p.symbol, side: p.side,
                openTime: new Date(p.openTime).getTime(),
                closeTime: new Date(p.closeTime).getTime(),
            });
        } catch { /* the autopsy stands without it */ }

        res.status(200).json({
            success: true,
            data: {
                trade: {
                    id: p.id ?? p._id, symbol: p.symbol, side: p.side, volume: p.volume,
                    entryPrice: p.entryPrice, closePrice: p.closePrice,
                    openTime: p.openTime, closeTime: p.closeTime, netProfit: p.finalProfit ?? 0,
                },
                context,
                ...report,
            },
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/**
 * Called by the client when the trade ticket opens. Warnings, not blocks:
 * the user's money, the user's call — but never an unexplained nudge.
 */
export const getPreTradeCheck = async (req: AuthRequest, res: Response) => {
    try {
        const symbol = String(req.query.symbol ?? '');
        const volume = Number(req.query.volume) || 0;
        if (!symbol) return res.status(400).json({ success: false, message: 'symbol is required' });

        const warnings: Array<{ key: string; fa: string; en: string }> = [];
        const trades = await loadManualClosedTrades(req.user!.id);
        const profile = await dnaFor(req.user!.id);
        const now = Date.now();

        // 1) This hour has historically hurt this user.
        const hour = new Date(now).getUTCHours();
        const worstHour = profile.findings.find(f => f.key === 'worstHour');
        if (worstHour && worstHour.evidence.hourUtc === hour) {
            warnings.push({
                key: 'worstHour',
                fa: `الان در بدترین ساعت معاملاتی خودتان هستید (${hour}:00 UTC): ${worstHour.evidence.trades} معامله‌ی قبلی این ساعت جمعاً ${worstHour.evidence.netProfit}$ داده.`,
                en: `You are inside your historically worst hour (${hour}:00 UTC): ${worstHour.evidence.trades} prior trades here total ${worstHour.evidence.netProfit}$.`,
            });
        }

        // 2) A loss closed minutes ago — revenge risk.
        const lastLoss = trades.filter(t => t.netProfit < 0).sort((a, b) => b.closeTime - a.closeTime)[0];
        if (lastLoss && now - lastLoss.closeTime <= 30 * 60_000) {
            const minsAgo = Math.max(1, Math.round((now - lastLoss.closeTime) / 60_000));
            warnings.push({
                key: 'revengeRisk',
                fa: `${minsAgo} دقیقه پیش یک ضرر بستید (${lastLoss.symbol}). معامله‌های شما در نیم‌ساعت بعد از ضرر، طبق سابقه‌ی خودتان ضعیف‌ترند — یک نفس عمیق.`,
                en: `You closed a loss ${minsAgo} minutes ago (${lastLoss.symbol}). By your own record, trades opened within 30 minutes of a loss underperform — take a breath.`,
            });
        }

        // 3) Volume far above the user's own norm.
        if (volume > 0 && trades.length >= 5) {
            const vols = trades.map(t => t.volume).sort((a, b) => a - b);
            const median = vols[Math.floor(vols.length / 2)];
            if (median > 0 && volume >= median * 2) {
                warnings.push({
                    key: 'volumeSpike',
                    fa: `این حجم (${volume} لات) ${(volume / median).toFixed(1)} برابر حجم معمول خودتان (${median} لات) است.`,
                    en: `This size (${volume} lots) is ${(volume / median).toFixed(1)}x your own median (${median} lots).`,
                });
            }
        }

        // 4) The live spread is unusually wide right now.
        const spread = getSpreadPips(symbol);
        if (spread !== undefined && spread > 5) {
            warnings.push({
                key: 'wideSpread',
                fa: `اسپرد ${symbol} همین حالا ${spread.toFixed(1)} پیپ است — بازتر از حالت عادی. ورود الان یعنی شروع از عقب‌تر.`,
                en: `The ${symbol} spread is ${spread.toFixed(1)} pips right now — wider than normal. Entering now starts you deeper in the hole.`,
            });
        }

        res.status(200).json({ success: true, data: { warnings } });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/**
 * RISK GUARD — the trader's own daily loss limit: read it, set it, see
 * whether it is currently locking new orders.
 */
export const getRiskGuard = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.user!.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        const cfg = riskGuardConfig((user as any).riskGuard);
        const account = user.cTraderAccounts?.find((a: any) => a.accountType === 'DEMO') || user.cTraderAccounts?.[0];
        const closed = await Position.find({ userId: req.user!.id, status: 'CLOSED', accountId: account?.cTraderId });
        const open = await Position.find({ userId: req.user!.id, status: 'OPEN', accountId: account?.cTraderId });
        const equity = accountMetrics(account?.balance ?? 0, open as any).equity;
        res.status(200).json({
            success: true,
            data: { config: cfg, state: evaluateRiskGuard(cfg, closed as any, equity) },
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const updateRiskGuard = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.user!.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        const next = riskGuardConfig({ ...riskGuardConfig((user as any).riskGuard), ...(req.body ?? {}) });
        (user as any).riskGuard = next;
        user.markModified?.('riskGuard');
        await user.save();
        res.status(200).json({ success: true, data: { config: next } });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/**
 * WEEKLY DIGEST — assembled from counted data, no AI call, so every user
 * can have one every week at zero marginal cost.
 */
export const getWeeklyDigest = async (req: AuthRequest, res: Response) => {
    try {
        const now = Date.now();
        const weekAgo = now - 7 * 86_400_000;

        const all = (await Position.find({ userId: req.user!.id, status: 'CLOSED' }) as any[]);
        const inWeek = all.filter(p => p.closeTime && new Date(p.closeTime).getTime() >= weekAgo);

        const manualWeek = computeTradeStats(inWeek.filter(p => !p.botId));
        const botRows = await Bot.listByUser(req.user!.id).catch(() => []);
        const events = await BotEvent.listByUser(req.user!.id, 40).catch(() => []);
        const weekEvents = events.filter(e => e.createdAt.getTime() >= weekAgo);

        const bots = botRows.map(b => {
            const mine = inWeek.filter(p => p.botId === b.id);
            return {
                name: b.name,
                status: b.status,
                trades: mine.length,
                netProfit: Number(mine.reduce((s, p) => s + Number(p.finalProfit ?? 0), 0).toFixed(2)),
                paused: weekEvents.some(e => e.botId === b.id && e.kind.startsWith('watchdog:') && e.severity === 'ALERT'),
            };
        }).filter(b => b.trades > 0 || b.paused || b.status !== 'STOPPED');

        const rolled = await getTradeStats(req.user!.id, 8).catch(() => ({
            days: 8, trades: 0, wins: 0, losses: 0, winRate: 0, netProfit: 0,
            grossProfit: 0, grossLoss: 0, profitFactor: 0, expectancy: 0, daily: [],
        }));
        const profile = await dnaFor(req.user!.id);

        const digest = buildWeeklyDigest({
            rolled, manualWeek, bots, findings: profile.findings, events: weekEvents.length, now,
        });
        res.status(200).json({ success: true, data: digest });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};
