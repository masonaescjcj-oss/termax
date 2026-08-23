/**
 * CUSTOM INDICATORS API — expressions in, validated by the compiler,
 * values out for the chart. Nothing unparseable ever reaches the database.
 */

import { Response } from 'express';
import CustomIndicator from '../models/CustomIndicator';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { limitsFor, planOf } from '../services/plans';
import { evalExprOverBars, parseExpr } from '../services/strategy/exprIndicator';
import { CODE_MAX_LENGTH, runCodeIndicator } from '../services/code/quickjsIndicator';
import { readBarsTf } from '../services/candles/store';
import { feedRouter } from '../services/feeds';
import { Bar, TIMEFRAMES, Timeframe } from '../services/strategy/types';


const MAX_VALUES = 500;

async function loadBars(symbol: string, timeframe: Timeframe, limit: number): Promise<Bar[]> {
    const now = Date.now();
    // Generous window: weekends thin out low timeframes.
    const spanMs = limit * 6 * ({ '1m': 60_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000, '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000, '1w': 604_800_000 }[timeframe] ?? 3_600_000);
    let bars = readBarsTf(symbol, timeframe, now - spanMs, now);
    if (bars.length < Math.min(limit, 30)) {
        const fetched = await feedRouter.getCandles(symbol, timeframe, limit);
        if (fetched?.length) {
            bars = fetched.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
        }
    }
    return bars.slice(-limit);
}

export const createIndicator = async (req: AuthRequest, res: Response) => {
    try {
        const { name, expr, code, kind, pane, color } = req.body ?? {};
        if (!name || typeof name !== 'string' || name.trim().length < 2 || name.length > 40) {
            return res.status(400).json({ success: false, message: 'name must be 2-40 characters.' });
        }
        const user = await User.findById(req.user!.id);
        const isCode = kind === 'CODE' || (!!code && !expr);

        if (isCode) {
            // The code tier is what PRO pays for.
            if (!limitsFor(user).codeIndicators) {
                return res.status(400).json({ success: false, message: 'Code indicators are a PRO feature. The expression tier is free.', paywall: true });
            }
            if (typeof code !== 'string' || !code.trim() || code.length > CODE_MAX_LENGTH) {
                return res.status(400).json({ success: false, message: `code must be 1-${CODE_MAX_LENGTH} characters.` });
            }
            // Dry-run in the cage against synthetic bars: syntax errors,
            // missing calc(), loops and bombs all die here, not on the chart.
            const probe = Array.from({ length: 60 }, (_, i) => ({ time: i * 60_000, open: 100 + i, high: 100.5 + i, low: 99.5 + i, close: 100 + i, volume: 1 }));
            const dry = await runCodeIndicator(code, probe);
            if (!dry.ok) {
                return res.status(400).json({ success: false, message: `The code failed its dry run: ${dry.error}` });
            }
        } else {
            const check = parseExpr(String(expr ?? ''));
            if (!check.ok) {
                return res.status(400).json({ success: false, message: 'Invalid expression', errors: check.errors });
            }
        }

        const existing = await CustomIndicator.listByUser(req.user!.id);
        const cap = limitsFor(user).maxCustomIndicators;
        if (existing.length >= cap) {
            return res.status(400).json({
                success: false,
                message: `Your ${planOf(user)} plan allows ${cap} custom indicators.`,
                paywall: planOf(user) === 'FREE',
            });
        }
        const row = await CustomIndicator.create(req.user!.id, {
            name: name.trim(),
            kind: isCode ? 'CODE' : 'EXPR',
            expr: isCode ? '' : String(expr),
            code: isCode ? String(code) : null,
            pane: pane === 'price' ? 'price' : 'separate',
            color: typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#F5A623',
        });
        res.status(200).json({ success: true, data: row });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const listIndicators = async (req: AuthRequest, res: Response) => {
    try {
        const rows = await CustomIndicator.listByUser(req.user!.id);
        res.status(200).json({ success: true, data: rows });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const toggleIndicator = async (req: AuthRequest, res: Response) => {
    try {
        const row = await CustomIndicator.findById(String(req.params.id));
        if (!row || row.userId !== req.user!.id) {
            return res.status(404).json({ success: false, message: 'Indicator not found' });
        }
        const enabled = req.body?.enabled !== false;
        await CustomIndicator.setEnabled(row.id, req.user!.id, enabled);
        res.status(200).json({ success: true, data: { ...row, enabled } });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const deleteIndicator = async (req: AuthRequest, res: Response) => {
    try {
        const removed = await CustomIndicator.remove(String(req.params.id), req.user!.id);
        if (!removed) return res.status(404).json({ success: false, message: 'Indicator not found' });
        res.status(200).json({ success: true, message: 'Indicator deleted' });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/**
 * All ENABLED indicators evaluated for one symbol/timeframe in one call —
 * the chart asks once per symbol switch, not once per indicator.
 */
export const indicatorValues = async (req: AuthRequest, res: Response) => {
    try {
        const symbol = String(req.query.symbol ?? '');
        const timeframe = String(req.query.timeframe ?? '1h') as Timeframe;
        if (!symbol) return res.status(400).json({ success: false, message: 'symbol is required' });
        if (!TIMEFRAMES.includes(timeframe)) {
            return res.status(400).json({ success: false, message: `timeframe must be one of ${TIMEFRAMES.join(', ')}` });
        }
        const limit = Math.min(MAX_VALUES, Math.max(30, Number(req.query.limit) || 300));

        const rows = await CustomIndicator.listByUser(req.user!.id, true);
        if (!rows.length) return res.status(200).json({ success: true, data: [] });

        const bars = await loadBars(symbol, timeframe, limit);
        if (bars.length < 10) {
            return res.status(200).json({ success: true, data: [], message: `No candle data for ${symbol} ${timeframe} yet.` });
        }

        const data = await Promise.all(rows.map(async row => {
            const base = { id: row.id, name: row.name, pane: row.pane, color: row.color, kind: row.kind };
            if (row.kind === 'CODE') {
                const out = await runCodeIndicator(row.code ?? '', bars);
                return out.ok
                    ? { ...base, points: out.values.map(v => ({ timestamp: v.time, value: Number(v.value.toFixed(8)) })) }
                    : { ...base, error: out.error };
            }
            const out = evalExprOverBars(row.expr, bars);
            return out.ok
                ? { ...base, points: out.values.map(v => ({ timestamp: v.time, value: Number(v.value.toFixed(8)) })) }
                : { ...base, error: out.errors.map(e => e.message).join('; ') };
        }));
        res.status(200).json({ success: true, data });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const exportIndicator = async (req: AuthRequest, res: Response) => {
    try {
        const row = await CustomIndicator.findById(String(req.params.id));
        if (!row || row.userId !== req.user!.id) {
            return res.status(404).json({ success: false, message: 'Indicator not found' });
        }
        const payload = {
            format: 'termax-indicator',
            version: 1,
            name: row.name,
            kind: row.kind,
            expr: row.kind === 'EXPR' ? row.expr : undefined,
            code: row.kind === 'CODE' ? row.code : undefined,
            pane: row.pane,
            color: row.color,
            exportedAt: new Date().toISOString(),
        };
        const filename = `${row.name.replace(/[^A-Za-z0-9\u0600-\u06FF_-]+/g, '_').slice(0, 40) || 'indicator'}.termax-indicator.json`;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.status(200).send(JSON.stringify(payload, null, 2));
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const importIndicator = async (req: AuthRequest, res: Response) => {
    try {
        let payload = req.body?.payload ?? req.body;
        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch {
                return res.status(400).json({ success: false, message: 'The file is not valid JSON.' });
            }
        }
        const name = String(payload?.name ?? '').trim();
        if (name.length < 2 || name.length > 40) {
            return res.status(400).json({ success: false, message: 'The file must carry a 2-40 character name.' });
        }
        const isCode = payload?.kind === 'CODE' || (!!payload?.code && !payload?.expr);
        const user = await User.findById(req.user!.id);
        if (isCode) {
            if (!limitsFor(user).codeIndicators) {
                return res.status(400).json({ success: false, message: 'This file is a CODE indicator — a PRO feature.', paywall: true });
            }
            const probe = Array.from({ length: 60 }, (_, i) => ({ time: i * 60_000, open: 100 + i, high: 100.5 + i, low: 99.5 + i, close: 100 + i, volume: 1 }));
            const dry = await runCodeIndicator(String(payload?.code ?? ''), probe);
            if (!dry.ok) {
                return res.status(400).json({ success: false, message: `The file's code failed its dry run: ${dry.error}` });
            }
        } else {
            const check = parseExpr(String(payload?.expr ?? ''));
            if (!check.ok) {
                return res.status(400).json({ success: false, message: 'Invalid expression in the file', errors: check.errors });
            }
        }
        const existing = await CustomIndicator.listByUser(req.user!.id);
        const cap = limitsFor(user).maxCustomIndicators;
        if (existing.length >= cap) {
            return res.status(400).json({
                success: false,
                message: `Your ${planOf(user)} plan allows ${cap} custom indicators.`,
                paywall: planOf(user) === 'FREE',
            });
        }
        const row = await CustomIndicator.create(req.user!.id, {
            name,
            kind: isCode ? 'CODE' : 'EXPR',
            expr: isCode ? '' : String(payload.expr),
            code: isCode ? String(payload.code) : null,
            pane: payload?.pane === 'price' ? 'price' : 'separate',
            color: typeof payload?.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(payload.color) ? payload.color : '#F5A623',
            origin: 'IMPORT',
        });
        res.status(200).json({ success: true, data: row });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};
