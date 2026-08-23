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
import { runAutopsy } from '../services/insights/autopsy';

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
        res.status(200).json({ success: true, data: profile });
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

        res.status(200).json({
            success: true,
            data: {
                trade: {
                    id: p.id ?? p._id, symbol: p.symbol, side: p.side, volume: p.volume,
                    entryPrice: p.entryPrice, closePrice: p.closePrice,
                    openTime: p.openTime, closeTime: p.closeTime, netProfit: p.finalProfit ?? 0,
                },
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
