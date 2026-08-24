/**
 * JOURNAL — the trader's own record, written for them.
 *
 * Three views, one data path:
 *   month  — the calendar heatmap, the discipline streak, the habit table
 *   day    — the day's recap and one auto-written entry per trade
 *   note   — the only place the trader's own words are stored
 *
 * The expensive part is classifying each trade's market regime, which
 * reads candle files. That is done once per user per 10 minutes and
 * cached, so paging through months costs nothing after the first open.
 */

import { Response } from 'express';
import Position from '../models/Position';
import TradeNote, { EMOTIONS, Emotion } from '../models/TradeNote';
import { AuthRequest } from '../middleware/auth';
import { classifyContext, JournalTags } from '../services/insights/journal';
import {
    autoTags, renderEntry, renderDayRecap, resultPips, stopPipsOf,
    TAG_META, JournalTradeInput,
} from '../services/insights/journalEntry';
import {
    buildMonth, computeStreak, sliceByTag, localDayKey, JournalRow,
    dayLabelFa, jalaliMonthOf,
} from '../services/insights/journalCalendar';
import { runAutopsy } from '../services/insights/autopsy';

/** Trades older than this are not journalled — the record, not the archive. */
const LOOKBACK_DAYS = 400;
const MAX_TRADES = 400;
const CACHE_TTL_MS = 10 * 60_000;
const SPARK_POINTS = 48;

interface JournalTrade extends JournalTradeInput {
    id: string;
    ctx: JournalTags | null;
    tags: string[];
}

const cache = new Map<string, { at: number; source: string; rows: JournalTrade[] }>();

const median = (xs: number[]): number | null => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Every journalled trade, tagged. Sorted oldest first, because the
 * revenge tag needs to know what closed immediately before each entry.
 */
async function journalTrades(userId: string, source: 'manual' | 'bot' | 'all'): Promise<JournalTrade[]> {
    const hit = cache.get(userId);
    if (hit && hit.source === source && Date.now() - hit.at < CACHE_TTL_MS) return hit.rows;

    const since = Date.now() - LOOKBACK_DAYS * 86_400_000;
    const raw = (await Position.find({ userId, status: 'CLOSED' }) as any[])
        .filter(p => p.openTime && p.closeTime)
        .filter(p => source === 'all' ? true : source === 'bot' ? !!p.botId : !p.botId)
        .map(p => ({
            id: String(p.id),
            symbol: p.symbol,
            side: p.side as 'BUY' | 'SELL',
            volume: Number(p.volume) || 0,
            entryPrice: Number(p.entryPrice) || 0,
            closePrice: Number(p.closePrice) || 0,
            openTime: new Date(p.openTime).getTime(),
            closeTime: new Date(p.closeTime).getTime(),
            netProfit: Number(p.finalProfit) || 0,
            stopLoss: p.stopLoss == null ? null : Number(p.stopLoss),
            takeProfit: p.takeProfit == null ? null : Number(p.takeProfit),
        }))
        .filter(p => p.closeTime >= since)
        .sort((a, b) => a.closeTime - b.closeTime)
        .slice(-MAX_TRADES);

    const medVol = median(raw.map(r => r.volume).filter(v => v > 0));

    const rows: JournalTrade[] = raw.map((t, i) => {
        let ctx: JournalTags | null = null;
        try {
            ctx = classifyContext({ symbol: t.symbol, side: t.side, openTime: t.openTime, closeTime: t.closeTime });
        } catch { /* a trade without candles still gets its facts */ }

        // The trade that closed last before this one opened — the only
        // one a revenge entry could be reacting to.
        let prev: typeof raw[number] | null = null;
        for (let j = i - 1; j >= 0; j--) {
            if (raw[j].closeTime <= t.openTime) { prev = raw[j]; break; }
        }

        return {
            ...t,
            ctx,
            tags: autoTags(t, ctx, {
                prevCloseTime: prev?.closeTime ?? null,
                prevWasLoss: prev ? prev.netProfit < 0 : false,
                medianVolume: medVol,
            }),
        };
    });

    cache.set(userId, { at: Date.now(), source, rows });
    return rows;
}

const toRow = (t: JournalTrade): JournalRow => ({
    id: t.id, symbol: t.symbol, side: t.side, volume: t.volume,
    netProfit: t.netProfit, openTime: t.openTime, closeTime: t.closeTime, tags: t.tags,
});

const num = (v: any, dflt: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : dflt;
};

/**
 * GET /journal/month — the whole screen in one request: the grid, the
 * streak, and the habit table.
 */
export const getJournalMonth = async (req: AuthRequest, res: Response) => {
    try {
        const calendar = req.query.calendar === 'gregorian' ? 'gregorian' : 'jalali';
        const source = (['manual', 'bot', 'all'].includes(String(req.query.source))
            ? String(req.query.source) : 'manual') as 'manual' | 'bot' | 'all';
        // The client sends -new Date().getTimezoneOffset(): +210 for Tehran.
        const tz = Math.max(-840, Math.min(840, num(req.query.tz, 0)));

        const trades = await journalTrades(req.user!.id, source);
        const rows = trades.map(toRow);

        const today = localDayKey(Date.now(), tz);
        const fallback = calendar === 'jalali'
            ? jalaliMonthOf(today)
            : { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
        const year = num(req.query.year, fallback.year);
        const month = Math.max(1, Math.min(12, num(req.query.month, fallback.month)));

        const view = buildMonth(rows, { calendar, year, month, tzOffsetMinutes: tz });
        const streak = computeStreak(rows, tz);

        // Habits over the last 90 days: long enough to be a pattern,
        // recent enough to still be true of how the trader trades now.
        const cutoff = Date.now() - 90 * 86_400_000;
        const recent = rows.filter(r => r.closeTime >= cutoff);

        res.status(200).json({
            success: true,
            data: {
                ...view,
                today,
                source,
                streak: {
                    ...streak,
                    // What ended the run *before* the current one — so the
                    // client never prints "broken by X" next to a live
                    // streak and contradicts itself.
                    lastBreakFa: streak.brokenBy?.map(k => TAG_META[k]?.fa ?? k) ?? null,
                },
                habits: { days: 90, trades: recent.length, slices: sliceByTag(recent) },
                totalJournalled: rows.length,
            },
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/** Closes, thinned to a drawable series, with the entry/exit kept exact. */
function sparkline(candles: Array<{ close: number }>, entryIndex: number, exitIndex: number) {
    if (!candles.length) return null;
    const step = Math.max(1, Math.ceil(candles.length / SPARK_POINTS));
    const idx: number[] = [];
    for (let i = 0; i < candles.length; i += step) idx.push(i);
    // Keep the two indices that carry meaning, wherever they landed.
    for (const keep of [entryIndex, exitIndex, candles.length - 1]) {
        if (keep >= 0 && keep < candles.length && !idx.includes(keep)) idx.push(keep);
    }
    idx.sort((a, b) => a - b);
    return {
        values: idx.map(i => Number(candles[i].close.toFixed(6))),
        entryAt: idx.indexOf(entryIndex),
        exitAt: idx.indexOf(exitIndex),
    };
}

/**
 * GET /journal/day — the day's trades, each with the entry the journal
 * wrote for it. This is the only view that runs a full autopsy per
 * trade, which is what pays for the "one thing worth noticing" line.
 */
export const getJournalDay = async (req: AuthRequest, res: Response) => {
    try {
        const date = String(req.query.date ?? '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD' });
        }
        const tz = Math.max(-840, Math.min(840, num(req.query.tz, 0)));
        const source = (['manual', 'bot', 'all'].includes(String(req.query.source))
            ? String(req.query.source) : 'manual') as 'manual' | 'bot' | 'all';

        const all = await journalTrades(req.user!.id, source);
        const day = all.filter(t => localDayKey(t.closeTime, tz) === date);
        const notes = await TradeNote.listByPositions(req.user!.id, day.map(t => t.id)).catch(() => new Map());

        const trades = day.map(t => {
            let verdictFa: string | null = null;
            let verdictEn: string | null = null;
            let spark: ReturnType<typeof sparkline> = null;
            const tags = [...t.tags];

            try {
                const report = runAutopsy({
                    symbol: t.symbol, side: t.side, volume: t.volume,
                    entryPrice: t.entryPrice, closePrice: t.closePrice,
                    openTime: t.openTime, closeTime: t.closeTime,
                    netProfit: t.netProfit, stopLoss: t.stopLoss, takeProfit: t.takeProfit,
                });
                if (report.ok) {
                    const notable = report.verdicts.find(v => v.key !== 'cleanLossOrWin');
                    if (notable) { verdictFa = notable.fa; verdictEn = notable.en; }
                    if (report.verdicts.some(v => v.key === 'stoppedThenReversed')) tags.push('stopHunted');
                    if (report.verdicts.some(v => v.key === 'gaveBackProfit')) tags.push('gaveBack');
                    spark = sparkline(report.candles, report.entryIndex, report.exitIndex);
                }
            } catch { /* the entry stands on the trade's own facts */ }

            const note = notes.get(t.id) ?? null;
            return {
                id: t.id,
                symbol: t.symbol, side: t.side, volume: t.volume,
                entryPrice: t.entryPrice, closePrice: t.closePrice,
                openTime: t.openTime, closeTime: t.closeTime,
                netProfit: t.netProfit,
                pips: resultPips(t),
                stopPips: stopPipsOf(t),
                tags: [...new Set(tags)],
                tagMeta: [...new Set(tags)].map(k => TAG_META[k]).filter(Boolean),
                entry: renderEntry(t, t.ctx, { verdictFa, verdictEn }),
                context: t.ctx,
                spark,
                note: note ? { note: note.note, emotion: note.emotion, tags: note.tags, updatedAt: note.updatedAt } : null,
            };
        }).sort((a, b) => a.closeTime - b.closeTime);

        res.status(200).json({
            success: true,
            data: {
                day: date,
                labelFa: dayLabelFa(date),
                recap: renderDayRecap(trades.map(t => ({
                    netProfit: t.netProfit, symbol: t.symbol, side: t.side, tags: t.tags,
                }))),
                trades,
            },
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/** POST /journal/note/:positionId — the trader's own words. */
export const saveJournalNote = async (req: AuthRequest, res: Response) => {
    try {
        const { note, emotion, tags } = req.body ?? {};
        if (emotion != null && !EMOTIONS.includes(emotion)) {
            return res.status(400).json({ success: false, message: `emotion must be one of ${EMOTIONS.join(', ')}` });
        }
        if (note != null && typeof note !== 'string') {
            return res.status(400).json({ success: false, message: 'note must be a string' });
        }
        if (tags != null && (!Array.isArray(tags) || tags.some((t: any) => typeof t !== 'string'))) {
            return res.status(400).json({ success: false, message: 'tags must be an array of strings' });
        }

        // The trade has to be this user's, or a note could be attached to
        // someone else's position id.
        const positionId = String(req.params.positionId);
        const owned = await Position.findOne({ id: positionId, userId: req.user!.id });
        if (!owned) return res.status(404).json({ success: false, message: 'Trade not found' });

        const saved = await TradeNote.upsert(req.user!.id, positionId, {
            note: typeof note === 'string' ? note : '',
            emotion: (emotion ?? null) as Emotion | null,
            tags: Array.isArray(tags) ? tags.map((t: string) => t.slice(0, 24)) : [],
        });
        res.status(200).json({ success: true, data: saved });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/** DELETE /journal/note/:positionId */
export const deleteJournalNote = async (req: AuthRequest, res: Response) => {
    try {
        await TradeNote.remove(req.user!.id, String(req.params.positionId));
        res.status(200).json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};
