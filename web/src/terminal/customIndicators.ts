/**
 * The trader's own indicators — expressions (free) or code (PRO) — are
 * evaluated on the server for the bars on screen and drawn here as
 * klinecharts indicators. One template per indicator id; the series it
 * reads lives in a module map so a refetch swaps the data without
 * re-registering.
 */
import { registerIndicator } from 'klinecharts';
import { api, data, q } from '../api';

export interface CustomIndicator {
    id: string;
    name: string;
    kind: 'EXPR' | 'CODE';
    expr: string;
    code: string | null;
    pane: 'price' | 'separate';
    color: string;
    enabled: boolean;
    origin: string;
    createdAt: string;
}

export interface IndicatorSeries { id: string; name: string; pane: 'price' | 'separate'; color: string; kind: string; points?: Array<{ timestamp: number; value: number }>; error?: string }

export const listIndicators = () => data<CustomIndicator[]>('/indicators');
export const createIndicator = (body: { name: string; expr?: string; code?: string; kind?: 'EXPR' | 'CODE'; pane: 'price' | 'separate'; color: string }) => data<CustomIndicator>('/indicators', { method: 'POST', body });
export const toggleIndicator = (id: string, enabled: boolean) => api(`/indicators/${id}/toggle`, { method: 'POST', body: { enabled } });
export const deleteIndicator = (id: string) => api(`/indicators/${id}`, { method: 'DELETE' });
export const fetchIndicatorValues = (symbol: string, timeframe: string, limit = 500) =>
    data<IndicatorSeries[]>(q('/indicators/values', { symbol, timeframe, limit }));

const series = new Map<string, Map<number, number>>();
const registered = new Set<string>();

export const templateName = (id: string) => `CUSTOM_${id.replace(/[^a-zA-Z0-9]/g, '')}`;

export function setSeries(id: string, points: Array<{ timestamp: number; value: number }>) {
    series.set(id, new Map(points.map(p => [p.timestamp, p.value])));
}

export function ensureTemplate(ind: { id: string; name: string }) {
    const name = templateName(ind.id);
    if (registered.has(name)) return name;
    registerIndicator({
        name,
        shortName: ind.name,
        precision: 4,
        figures: [{ key: 'v', title: `${ind.name}: `, type: 'line' }],
        calc: (dataList: any[]) => {
            const m = series.get(ind.id);
            return dataList.map(d => ({ v: m?.get(d.timestamp) ?? null }));
        },
    } as any);
    registered.add(name);
    return name;
}

/** Cheat sheet for the expression editor. */
export const EXPR_HELP = [
    ['close, open, high, low, volume, hl2, hlc3, ohlc4', 'candle series'],
    ['SMA(s, n)  EMA(s, n)  RSI(s, n)  ATR(n)', 'moving averages, RSI, average true range'],
    ['HIGHEST(s, n)  LOWEST(s, n)', 'rolling extremes'],
    ['REF(s, n)', 'the series n bars ago'],
    ['+ − × ÷ and parentheses', 'plain arithmetic'],
];
export const EXPR_EXAMPLES = [
    { name: 'Distance to EMA20 (ATR units)', expr: '(close - EMA(close, 20)) / ATR(14) * 100' },
    { name: 'Momentum 5', expr: 'SMA(hl2, 10) - REF(SMA(hl2, 10), 5)' },
    { name: 'Position in 20-bar range', expr: '100 * (close - LOWEST(low, 20)) / (HIGHEST(high, 20) - LOWEST(low, 20))' },
];
