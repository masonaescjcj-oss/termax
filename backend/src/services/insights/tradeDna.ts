/**
 * TRADE DNA — a behavioural profile computed from the trader's own closed
 * trades. Every finding is DETERMINISTIC: counted, not vibed. The AI may
 * narrate these numbers through a tool, but it never invents them — the
 * same rule the whole AI layer follows.
 *
 * Findings ship in Persian and English, rendered from the numbers the same
 * way describe.ts renders specs: the text the user reads is derived from
 * the evidence, so it can never drift from it.
 */

export interface DnaTrade {
    symbol: string;
    side: 'BUY' | 'SELL';
    volume: number;
    netProfit: number;
    openTime: number;   // ms
    closeTime: number;  // ms
}

export type DnaSeverity = 'INFO' | 'WARN' | 'ALERT';

export interface DnaFinding {
    key: 'revengeTrading' | 'dispositionEffect' | 'worstHour' | 'worstWeekday'
        | 'bestHour' | 'volumeCreepAfterLoss' | 'volumeTrend' | 'overtradingBurst';
    severity: DnaSeverity;
    fa: string;
    en: string;
    evidence: Record<string, number | string>;
}

export interface DnaBucket { bucket: number; trades: number; netProfit: number; wins: number }

export interface DnaProfile {
    trades: number;
    findings: DnaFinding[];
    /** Net P/L by UTC hour of ENTRY — the heatmap the client can draw. */
    hourly: DnaBucket[];
    weekdays: DnaBucket[];
    computedAt: number;
}

const REVENGE_WINDOW_MS = 30 * 60_000;
const MIN_SAMPLES = 3;

const WEEKDAY_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const WEEKDAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const money = (v: number) => `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`;

export function computeTradeDna(input: DnaTrade[], now = Date.now()): DnaProfile {
    const trades = input
        .filter(t => Number.isFinite(t.netProfit) && Number.isFinite(t.closeTime) && Number.isFinite(t.openTime))
        .sort((a, b) => a.closeTime - b.closeTime);

    const findings: DnaFinding[] = [];
    const n = trades.length;

    // ── time buckets ────────────────────────────────────────────────
    const hourly: DnaBucket[] = Array.from({ length: 24 }, (_, h) => ({ bucket: h, trades: 0, netProfit: 0, wins: 0 }));
    const weekdays: DnaBucket[] = Array.from({ length: 7 }, (_, d) => ({ bucket: d, trades: 0, netProfit: 0, wins: 0 }));
    for (const t of trades) {
        const d = new Date(t.openTime);
        const hb = hourly[d.getUTCHours()];
        hb.trades++; hb.netProfit += t.netProfit; if (t.netProfit > 0) hb.wins++;
        const wb = weekdays[d.getUTCDay()];
        wb.trades++; wb.netProfit += t.netProfit; if (t.netProfit > 0) wb.wins++;
    }

    if (n >= 10) {
        const eligibleH = hourly.filter(b => b.trades >= 4);
        const worstH = [...eligibleH].sort((a, b) => a.netProfit - b.netProfit)[0];
        if (worstH && worstH.netProfit < 0) {
            findings.push({
                key: 'worstHour', severity: worstH.netProfit < -50 ? 'WARN' : 'INFO',
                fa: `بدترین ساعت شما ${worstH.bucket}:00 تا ${worstH.bucket + 1}:00 UTC است: ${worstH.trades} معامله، جمعاً ${money(worstH.netProfit)}.`,
                en: `Your worst hour is ${worstH.bucket}:00–${worstH.bucket + 1}:00 UTC: ${worstH.trades} trades, ${money(worstH.netProfit)} total.`,
                evidence: { hourUtc: worstH.bucket, trades: worstH.trades, netProfit: Number(worstH.netProfit.toFixed(2)) },
            });
        }
        const bestH = [...eligibleH].sort((a, b) => b.netProfit - a.netProfit)[0];
        if (bestH && bestH.netProfit > 0) {
            findings.push({
                key: 'bestHour', severity: 'INFO',
                fa: `بهترین ساعت شما ${bestH.bucket}:00 تا ${bestH.bucket + 1}:00 UTC است: ${bestH.trades} معامله، جمعاً ${money(bestH.netProfit)}.`,
                en: `Your best hour is ${bestH.bucket}:00–${bestH.bucket + 1}:00 UTC: ${bestH.trades} trades, ${money(bestH.netProfit)} total.`,
                evidence: { hourUtc: bestH.bucket, trades: bestH.trades, netProfit: Number(bestH.netProfit.toFixed(2)) },
            });
        }
        const eligibleW = weekdays.filter(b => b.trades >= 4);
        const worstW = [...eligibleW].sort((a, b) => a.netProfit - b.netProfit)[0];
        if (worstW && worstW.netProfit < 0) {
            findings.push({
                key: 'worstWeekday', severity: 'INFO',
                fa: `بدترین روز هفته‌ی شما ${WEEKDAY_FA[worstW.bucket]} است: ${worstW.trades} معامله، جمعاً ${money(worstW.netProfit)}.`,
                en: `Your worst weekday is ${WEEKDAY_EN[worstW.bucket]}: ${worstW.trades} trades, ${money(worstW.netProfit)} total.`,
                evidence: { weekday: WEEKDAY_EN[worstW.bucket], trades: worstW.trades, netProfit: Number(worstW.netProfit.toFixed(2)) },
            });
        }
    }

    // ── revenge trading ─────────────────────────────────────────────
    // A trade opened within 30 minutes of a LOSS closing.
    {
        const revenge: DnaTrade[] = [];
        for (let i = 0; i < trades.length; i++) {
            const t = trades[i];
            const priorLoss = trades.some(p => p.netProfit < 0
                && p.closeTime <= t.openTime
                && t.openTime - p.closeTime <= REVENGE_WINDOW_MS);
            if (priorLoss) revenge.push(t);
        }
        if (revenge.length >= MIN_SAMPLES) {
            const revNet = revenge.reduce((s, t) => s + t.netProfit, 0);
            const revWinRate = revenge.filter(t => t.netProfit > 0).length / revenge.length * 100;
            const allWinRate = trades.filter(t => t.netProfit > 0).length / n * 100;
            if (revNet < 0 || revWinRate + 10 < allWinRate) {
                findings.push({
                    key: 'revengeTrading',
                    severity: revNet < 0 ? 'ALERT' : 'WARN',
                    fa: `${revenge.length} معامله را کمتر از ۳۰ دقیقه بعد از یک ضرر باز کرده‌اید — وین‌ریت این معامله‌ها ${revWinRate.toFixed(0)}٪ در برابر ${allWinRate.toFixed(0)}٪ کلی، جمعاً ${money(revNet)}. این الگوی معامله‌ی انتقامی است.`,
                    en: `${revenge.length} trades were opened within 30 minutes of a loss — win rate ${revWinRate.toFixed(0)}% vs your overall ${allWinRate.toFixed(0)}%, ${money(revNet)} total. That is the revenge-trading pattern.`,
                    evidence: { revengeTrades: revenge.length, revengeWinRate: Number(revWinRate.toFixed(1)), overallWinRate: Number(allWinRate.toFixed(1)), revengeNet: Number(revNet.toFixed(2)) },
                });
            }
        }
    }

    // ── disposition effect: cutting winners, riding losers ──────────
    {
        const wins = trades.filter(t => t.netProfit > 0 && t.closeTime > t.openTime);
        const losses = trades.filter(t => t.netProfit < 0 && t.closeTime > t.openTime);
        if (wins.length >= MIN_SAMPLES && losses.length >= MIN_SAMPLES) {
            const avgHold = (ts: DnaTrade[]) => ts.reduce((s, t) => s + (t.closeTime - t.openTime), 0) / ts.length / 60_000;
            const winHold = avgHold(wins);
            const lossHold = avgHold(losses);
            const avgWin = wins.reduce((s, t) => s + t.netProfit, 0) / wins.length;
            const avgLoss = Math.abs(losses.reduce((s, t) => s + t.netProfit, 0) / losses.length);
            if (winHold < lossHold * 0.6 && avgWin < avgLoss) {
                findings.push({
                    key: 'dispositionEffect', severity: 'ALERT',
                    fa: `سودها را زود می‌بندید و ضررها را نگه می‌دارید: میانگین نگهداری سود ${winHold.toFixed(0)} دقیقه در برابر ${lossHold.toFixed(0)} دقیقه برای ضرر؛ میانگین سود ${money(avgWin)} در برابر میانگین ضرر ${money(-avgLoss)}.`,
                    en: `You cut winners and ride losers: winners held ${winHold.toFixed(0)} min on average vs ${lossHold.toFixed(0)} min for losers; average win ${money(avgWin)} vs average loss ${money(-avgLoss)}.`,
                    evidence: { winHoldMin: Number(winHold.toFixed(1)), lossHoldMin: Number(lossHold.toFixed(1)), avgWin: Number(avgWin.toFixed(2)), avgLoss: Number(avgLoss.toFixed(2)) },
                });
            }
        }
    }

    // ── volume creep after losses (martingale drift) ────────────────
    {
        const afterLoss: number[] = [];
        const afterWin: number[] = [];
        for (let i = 1; i < trades.length; i++) {
            const prev = trades[i - 1];
            if (trades[i].openTime >= prev.closeTime) {
                (prev.netProfit < 0 ? afterLoss : afterWin).push(trades[i].volume);
            }
        }
        if (afterLoss.length >= 4 && afterWin.length >= 4) {
            const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
            const ratio = avg(afterLoss) / Math.max(1e-9, avg(afterWin));
            if (ratio >= 1.3) {
                findings.push({
                    key: 'volumeCreepAfterLoss', severity: ratio >= 1.8 ? 'ALERT' : 'WARN',
                    fa: `بعد از ضرر، حجم را بزرگ می‌کنید: میانگین حجم بعد از ضرر ${avg(afterLoss).toFixed(2)} لات در برابر ${avg(afterWin).toFixed(2)} بعد از سود (×${ratio.toFixed(1)}). این خزش به سمت مارتینگل است.`,
                    en: `You size up after losses: average volume ${avg(afterLoss).toFixed(2)} lots after a loss vs ${avg(afterWin).toFixed(2)} after a win (×${ratio.toFixed(1)}). That is martingale drift.`,
                    evidence: { avgVolumeAfterLoss: Number(avg(afterLoss).toFixed(2)), avgVolumeAfterWin: Number(avg(afterWin).toFixed(2)), ratio: Number(ratio.toFixed(2)) },
                });
            }
        }
    }

    // ── overtrading bursts ──────────────────────────────────────────
    {
        const byDay = new Map<string, { count: number; net: number }>();
        for (const t of trades) {
            const key = new Date(t.openTime).toISOString().slice(0, 10);
            const cur = byDay.get(key) ?? { count: 0, net: 0 };
            cur.count++; cur.net += t.netProfit;
            byDay.set(key, cur);
        }
        const days = [...byDay.entries()];
        if (days.length >= 5) {
            const counts = days.map(([, v]) => v.count).sort((a, b) => a - b);
            const median = counts[Math.floor(counts.length / 2)];
            const [burstDay, burst] = [...days].sort((a, b) => b[1].count - a[1].count)[0];
            if (burst.count >= 8 && burst.count >= median * 3) {
                findings.push({
                    key: 'overtradingBurst', severity: burst.net < 0 ? 'WARN' : 'INFO',
                    fa: `روز ${burstDay} تعداد ${burst.count} معامله باز کرده‌اید (میانه‌ی شما ${median} در روز) با نتیجه‌ی ${money(burst.net)} — نشانه‌ی روز پرمعامله‌ی هیجانی.`,
                    en: `On ${burstDay} you opened ${burst.count} trades (your median is ${median}/day) for ${money(burst.net)} — an overtrading burst.`,
                    evidence: { day: burstDay, trades: burst.count, medianPerDay: median, dayNet: Number(burst.net.toFixed(2)) },
                });
            }
        }
    }

    // Severity order: ALERT first — the client shows the list as-is.
    const rank: Record<DnaSeverity, number> = { ALERT: 0, WARN: 1, INFO: 2 };
    findings.sort((a, b) => rank[a.severity] - rank[b.severity]);

    return { trades: n, findings, hourly, weekdays, computedAt: now };
}
