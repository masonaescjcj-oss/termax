/**
 * Trader positioning per symbol: how many of Termax's own open positions
 * are long versus short, by count and by volume. One database read a
 * minute, shared by every request.
 */
import Position from '../models/Position';

export interface Sentiment {
    symbol: string;
    longs: number;
    shorts: number;
    longVolume: number;
    shortVolume: number;
    traders: number;
    /** Share of traders who are net long, 0–100; null with nobody positioned. */
    longPct: number | null;
}

let cache: Map<string, Sentiment> = new Map();
let fetchedAt = 0;
let inflight: Promise<void> | null = null;
const TTL_MS = 60_000;

/** Pure: fold open positions into per-symbol sentiment. Exported for the tests. */
export function foldSentiment(positions: Array<{ symbol: string; side: string; volume: number; userId: string }>): Map<string, Sentiment> {
    const out = new Map<string, Sentiment>();
    const traderSides = new Map<string, Map<string, number>>(); // symbol -> userId -> net side (+long/-short volume)
    for (const p of positions) {
        if (!p.symbol) continue;
        const s = out.get(p.symbol) ?? { symbol: p.symbol, longs: 0, shorts: 0, longVolume: 0, shortVolume: 0, traders: 0, longPct: null };
        const vol = Number(p.volume) || 0;
        if (p.side === 'BUY') { s.longs++; s.longVolume += vol; } else { s.shorts++; s.shortVolume += vol; }
        out.set(p.symbol, s);
        if (!traderSides.has(p.symbol)) traderSides.set(p.symbol, new Map());
        const t = traderSides.get(p.symbol)!;
        t.set(String(p.userId), (t.get(String(p.userId)) ?? 0) + (p.side === 'BUY' ? vol : -vol));
    }
    for (const [symbol, s] of out) {
        const nets = [...(traderSides.get(symbol)?.values() ?? [])];
        s.traders = nets.length;
        const longTraders = nets.filter(v => v > 0).length;
        const positioned = nets.filter(v => v !== 0).length;
        s.longPct = positioned ? Math.round((longTraders / positioned) * 100) : null;
        s.longVolume = Number(s.longVolume.toFixed(2));
        s.shortVolume = Number(s.shortVolume.toFixed(2));
    }
    return out;
}

async function refresh(): Promise<void> {
    if (inflight) return inflight;
    inflight = (async () => {
        try {
            const rows = (await Position.find({ status: 'OPEN' })) as any[];
            cache = foldSentiment(rows.map(p => ({ symbol: p.symbol, side: p.side, volume: p.volume, userId: p.userId })));
            fetchedAt = Date.now();
        } finally {
            inflight = null;
        }
    })();
    return inflight;
}

export async function getSentiment(symbols?: string[]): Promise<Sentiment[]> {
    if (Date.now() - fetchedAt > TTL_MS) await refresh();
    const all = [...cache.values()];
    if (!symbols?.length) return all.sort((a, b) => b.traders - a.traders);
    return symbols.map(s => cache.get(s) ?? { symbol: s, longs: 0, shorts: 0, longVolume: 0, shortVolume: 0, traders: 0, longPct: null });
}
