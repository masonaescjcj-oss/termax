/**
 * A bot's record painted on its chart: every closed trade as an entry→exit
 * segment coloured by outcome, the open position's levels, and the
 * indicators its rules read, mapped to klinecharts built-ins.
 */
import { registerOverlay, type Chart as KChart } from 'klinecharts';

export interface BotChartData {
    botId: string;
    name: string;
    symbol: string;
    timeframe: string;
    indicators: Array<{ name: string; def: any }>;
    trades: Array<{ side: 'BUY' | 'SELL'; volume: number; entryTime: number; entryPrice: number; exitTime: number; exitPrice: number; netProfit: number }>;
    open: { side: 'BUY' | 'SELL'; volume: number; entryPrice: number; stopLoss: number | null; takeProfit: number | null; openTime: number | null } | null;
}

const GREEN = '#089981', RED = '#f23645';

let registered = false;
export function ensureBotOverlay() {
    if (registered) return;
    registerOverlay({
        name: 'botTrade',
        totalStep: 3,
        lock: true,
        needDefaultPointFigure: false,
        needDefaultXAxisFigure: false,
        needDefaultYAxisFigure: false,
        createPointFigures: ({ overlay, coordinates }: { overlay: any; coordinates: Array<{ x: number; y: number }> }) => {
            if (coordinates.length < 2) return [];
            const t = (overlay.extendData ?? {}) as { side: string; netProfit: number };
            const win = t.netProfit >= 0;
            const color = win ? GREEN : RED;
            const [a, b] = coordinates;
            const isBuy = t.side === 'BUY';
            const tri = (x: number, y: number, up: boolean) => ({
                type: 'polygon', ignoreEvent: true,
                attrs: { coordinates: up ? [{ x, y: y + 4 }, { x: x - 5, y: y + 13 }, { x: x + 5, y: y + 13 }] : [{ x, y: y - 4 }, { x: x - 5, y: y - 13 }, { x: x + 5, y: y - 13 }] },
                styles: { style: 'fill', color: isBuy ? GREEN : RED },
            });
            return [
                { type: 'line', ignoreEvent: true, attrs: { coordinates: [a, b] }, styles: { color, size: 1.5, style: 'dashed', dashedValue: [4, 3] } },
                tri(a.x, a.y, isBuy),
                { type: 'circle', ignoreEvent: true, attrs: { x: b.x, y: b.y, r: 3.5 }, styles: { style: 'fill', color } },
                { type: 'rectText', ignoreEvent: true, attrs: { x: b.x + 6, y: b.y, text: `${t.netProfit >= 0 ? '+' : '-'}$${Math.abs(t.netProfit).toFixed(2)}`, align: 'left', baseline: 'middle' }, styles: { color: '#fff', backgroundColor: color, size: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: 2 } },
            ];
        },
    } as any);
    registered = true;
}

/** StrategySpec indicator → klinecharts built-in with the spec's params. */
export function mapSpecIndicator(def: any): { name: string; main: boolean; params: number[] } | null {
    switch (def?.type) {
        case 'SMA': return { name: 'MA', main: true, params: [def.period ?? 20] };
        case 'EMA': return { name: 'EMA', main: true, params: [def.period ?? 20] };
        case 'RSI': return { name: 'RSI', main: false, params: [def.period ?? 14] };
        case 'MACD': return { name: 'MACD', main: false, params: [def.fast ?? 12, def.slow ?? 26, def.signal ?? 9] };
        case 'BBANDS': return { name: 'BOLL', main: true, params: [def.period ?? 20, def.mult ?? 2] };
        case 'STOCH': return { name: 'KDJ', main: false, params: [def.kPeriod ?? 14, def.dPeriod ?? 3, 3] };
        default: return null;
    }
}

export function drawBotTrades(chart: KChart, bot: BotChartData) {
    ensureBotOverlay();
    chart.removeOverlay({ groupId: 'bot' } as any);
    bot.trades.forEach((t, i) => {
        chart.createOverlay({
            id: `bot-${bot.botId}-${i}`, name: 'botTrade', groupId: 'bot', lock: true,
            points: [{ timestamp: t.entryTime, value: t.entryPrice }, { timestamp: t.exitTime, value: t.exitPrice }],
            extendData: { side: t.side, netProfit: t.netProfit },
        } as any);
    });
}
