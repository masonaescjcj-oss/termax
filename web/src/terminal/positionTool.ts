/**
 * The Long/Short Position tool — the box every trader draws before an
 * entry: where it opens, where it is wrong (stop) and where it pays
 * (target), with the reward-to-risk and the money at stake written on it.
 *
 * Three clicks: entry, target, stop. Every point stays draggable. The
 * figures are computed from the overlay's own points, so the numbers on
 * the box are always the numbers the order will carry.
 */
import { registerOverlay, type OverlayTemplate } from 'klinecharts';
import { contractSizeOf, fmtPrice } from '../symbols';

export interface PositionToolData {
    side: 'BUY' | 'SELL';
    symbol: string;
    volume: number;
}

export interface PositionDraft extends PositionToolData {
    entry: number;
    target: number | null;
    stop: number | null;
    rr: number | null;
    risk: number | null;
    reward: number | null;
}

const GREEN = '#089981', RED = '#f23645', BLUE = '#2962ff';

/** What the tool currently says, from its points. Shared with the React side. */
export function draftFromPoints(points: Array<{ value?: number }>, data: PositionToolData): PositionDraft | null {
    const entry = points[0]?.value;
    if (entry == null) return null;
    const target = points[1]?.value ?? null;
    const stop = points[2]?.value ?? null;
    const size = contractSizeOf(data.symbol) * data.volume;
    const reward = target == null ? null : Math.abs(target - entry) * size;
    const risk = stop == null ? null : Math.abs(entry - stop) * size;
    const rr = reward != null && risk ? reward / risk : null;
    return { ...data, entry, target, stop, rr, risk, reward };
}

const template: OverlayTemplate = {
    name: 'longShortPosition',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
        const data = (overlay.extendData ?? {}) as PositionToolData;
        const draft = draftFromPoints(overlay.points as any, data);
        if (!draft || coordinates.length === 0) return [];
        const isLong = data.side === 'BUY';
        const x0 = Math.min(...coordinates.map(c => c.x));
        const x1 = Math.max(Math.max(...coordinates.map(c => c.x)) + 40, x0 + 160);
        const right = Math.min(x1, bounding.width - 4);
        const yEntry = coordinates[0].y;
        const figures: any[] = [];

        const money = (v: number | null) => (v == null ? '' : `$${v.toFixed(2)}`);
        const label = (y: number, text: string, color: string) => ({
            type: 'rectText',
            attrs: { x: x0 + 6, y, text, align: 'left', baseline: 'middle' },
            styles: { color: '#fff', backgroundColor: color, size: 11, paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2, borderRadius: 3 },
            ignoreEvent: true,
        });

        if (coordinates[1]) {
            const yT = coordinates[1].y;
            figures.push({ type: 'rect', attrs: { x: x0, y: Math.min(yEntry, yT), width: right - x0, height: Math.abs(yT - yEntry) }, styles: { style: 'fill', color: 'rgba(8,153,129,0.18)' }, ignoreEvent: true });
            figures.push({ type: 'line', attrs: { coordinates: [{ x: x0, y: yT }, { x: right, y: yT }] }, styles: { color: GREEN, size: 1 }, ignoreEvent: true });
            figures.push(label(yT + (yT < yEntry ? 10 : -10), `Target ${fmtPrice(data.symbol, draft.target)}  +${money(draft.reward)}`, GREEN));
        }
        if (coordinates[2]) {
            const yS = coordinates[2].y;
            figures.push({ type: 'rect', attrs: { x: x0, y: Math.min(yEntry, yS), width: right - x0, height: Math.abs(yS - yEntry) }, styles: { style: 'fill', color: 'rgba(242,54,69,0.18)' }, ignoreEvent: true });
            figures.push({ type: 'line', attrs: { coordinates: [{ x: x0, y: yS }, { x: right, y: yS }] }, styles: { color: RED, size: 1 }, ignoreEvent: true });
            figures.push(label(yS + (yS > yEntry ? -10 : 10), `Stop ${fmtPrice(data.symbol, draft.stop)}  -${money(draft.risk)}`, RED));
        }
        figures.push({ type: 'line', attrs: { coordinates: [{ x: x0, y: yEntry }, { x: right, y: yEntry }] }, styles: { color: BLUE, size: 1 }, ignoreEvent: true });
        const head = `${isLong ? 'Long' : 'Short'} ${data.volume} ${data.symbol} @ ${fmtPrice(data.symbol, draft.entry)}${draft.rr != null ? `  ·  R:R ${draft.rr.toFixed(2)}` : ''}`;
        figures.push(label(yEntry, head, BLUE));
        return figures;
    },
};

let registered = false;
export function ensurePositionTool() {
    if (registered) return;
    registerOverlay(template);
    registered = true;
}
