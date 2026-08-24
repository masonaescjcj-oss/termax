/**
 * WEEKLY DIGEST — the week, told in numbers the user can check.
 *
 * Assembled from what is already counted: the trade-stats rollup, the
 * bots' records, Trade DNA findings, and the watchdog's events. The text
 * is rendered from those numbers here, in Persian and English — no AI
 * call, so a weekly digest for every user costs nothing per user.
 *
 * The single "one thing to fix" line is the point of the whole feature:
 * a wall of statistics changes nobody's behaviour, one sentence might.
 */

import { DnaFinding } from './tradeDna';
import { RolledStats } from '../ai/statsRollup';
import { TradeStats } from '../bots/tradeStats';

export interface DigestBotLine {
    name: string;
    status: string;
    trades: number;
    netProfit: number;
    /** Watchdog paused it during the week. */
    paused: boolean;
}

export interface WeeklyDigest {
    from: number;
    to: number;
    manual: {
        trades: number;
        winRate: number;
        netProfit: number;
        expectancy: number;
        bestDay: { day: string; netProfit: number } | null;
        worstDay: { day: string; netProfit: number } | null;
    };
    bots: DigestBotLine[];
    botsNet: number;
    /** The behavioural finding worth acting on this week. */
    focus: { fa: string; en: string } | null;
    headlineFa: string;
    headlineEn: string;
    events: number;
}

const money = (v: number) => `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`;

export function buildWeeklyDigest(input: {
    rolled: RolledStats;
    manualWeek: TradeStats;
    bots: DigestBotLine[];
    findings: DnaFinding[];
    events: number;
    now?: number;
}): WeeklyDigest {
    const now = input.now ?? Date.now();
    const from = now - 7 * 86_400_000;

    const daily = input.rolled.daily.filter(d => Date.parse(`${d.day}T12:00:00Z`) >= from);
    const sorted = [...daily].sort((a, b) => b.netProfit - a.netProfit);
    const bestDay = sorted.length && sorted[0].netProfit > 0
        ? { day: sorted[0].day, netProfit: Number(sorted[0].netProfit.toFixed(2)) } : null;
    const worstDay = sorted.length && sorted[sorted.length - 1].netProfit < 0
        ? { day: sorted[sorted.length - 1].day, netProfit: Number(sorted[sorted.length - 1].netProfit.toFixed(2)) } : null;

    const botsNet = input.bots.reduce((s, b) => s + b.netProfit, 0);
    const total = input.manualWeek.netProfit + botsNet;

    // The focus line: the most severe finding, ALERTs first.
    const rank = { ALERT: 0, WARN: 1, INFO: 2 } as const;
    const focusFinding = [...input.findings].sort((a, b) => rank[a.severity] - rank[b.severity])[0];
    const focus = focusFinding && focusFinding.severity !== 'INFO'
        ? { fa: focusFinding.fa, en: focusFinding.en }
        : null;

    const paused = input.bots.filter(b => b.paused).length;
    const headlineFa = input.manualWeek.trades === 0 && input.bots.every(b => b.trades === 0)
        ? 'این هفته معامله‌ای بسته نشد.'
        : `این هفته ${input.manualWeek.trades} معامله‌ی دستی و ${input.bots.reduce((s, b) => s + b.trades, 0)} معامله‌ی ربات بسته شد؛ جمع کل ${money(total)}.`
            + (paused ? ` ${paused} ربات توسط نگهبان متوقف شد.` : '');
    const headlineEn = input.manualWeek.trades === 0 && input.bots.every(b => b.trades === 0)
        ? 'No trades closed this week.'
        : `${input.manualWeek.trades} manual and ${input.bots.reduce((s, b) => s + b.trades, 0)} bot trades closed this week; ${money(total)} in total.`
            + (paused ? ` ${paused} bot(s) were paused by the watchdog.` : '');

    return {
        from, to: now,
        manual: {
            trades: input.manualWeek.trades,
            winRate: Number(input.manualWeek.winRate.toFixed(1)),
            netProfit: Number(input.manualWeek.netProfit.toFixed(2)),
            expectancy: Number(input.manualWeek.expectancy.toFixed(2)),
            bestDay, worstDay,
        },
        bots: input.bots,
        botsNet: Number(botsNet.toFixed(2)),
        focus,
        headlineFa, headlineEn,
        events: input.events,
    };
}
