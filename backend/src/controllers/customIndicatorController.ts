/**
 * CUSTOM INDICATORS API — expressions in, validated by the compiler,
 * values out for the chart. Nothing unparseable ever reaches the database.
 */

import { Response } from 'express';
import CustomIndicator from '../models/CustomIndicator';
import { AuthRequest } from '../middleware/auth';
import { evalExprOverBars, parseExpr } from '../services/strategy/exprIndicator';
import { readBarsTf } from '../services/candles/store';
import { feedRouter } from '../services/feeds';
import { Bar, TIMEFRAMES, Timeframe } from '../services/strategy/types';

const MAX_PER_USER = 20;
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
        const { name, expr, pane, color } = req.body ?? {};
        if (!name || typeof name !== 'string' || name.trim().length < 2 || name.length > 40) {
            return res.status(400).json({ success: false, message: 'name must be 2-40 characters.' });
        }
        const check = parseExpr(String(expr ?? ''));
        if (!check.ok) {
            return res.status(400).json({ success: false, message: 'Invalid expression', errors: check.errors });
        }
        const existing = await CustomIndicator.listByUser(req.user!.id);
        if (existing.length >= MAX_PER_USER) {
            return res.status(400).json({ success: false, message: `You can keep at most ${MAX_PER_USER} custom indicators.` });
        }
        const row = await CustomIndicator.create(req.user!.id, {
            name: name.trim(),
            expr: String(expr),
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

        const data = rows.map(row => {
            const out = evalExprOverBars(row.expr, bars);
            return {
                id: row.id,
                name: row.name,
                pane: row.pane,
                color: row.color,
                ...(out.ok
                    ? { points: out.values.map(v => ({ timestamp: v.time, value: Number(v.value.toFixed(8)) })) }
                    : { error: out.errors.map(e => e.message).join('; ') }),
            };
        });
        res.status(200).json({ success: true, data });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};
