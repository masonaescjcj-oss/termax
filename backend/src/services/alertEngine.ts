/**
 * Server-side price alerts.
 *
 * Active alerts live in memory, indexed by symbol, so checking a tick is
 * a map lookup — the feed emits thousands of quotes a minute and the
 * database must not be in that path. The index is loaded at boot and
 * patched on every create/remove/rearm; a full reload every few minutes
 * covers anything written by another process.
 */
import { PriceAlert, PriceAlertRow } from '../models/PriceAlert';
import { notify } from './notify';

type Fire = (alert: PriceAlertRow, price: number) => Promise<void> | void;

/** Pure: does this quote satisfy the alert? Exported for the tests. */
export function alertHit(alert: Pick<PriceAlertRow, 'condition' | 'price'>, price: number): boolean {
    if (!Number.isFinite(price)) return false;
    return alert.condition === 'above' ? price >= alert.price : price <= alert.price;
}

const bySymbol = new Map<string, Map<string, PriceAlertRow>>();
const firing = new Set<string>();
let loaded = false;

function index(alert: PriceAlertRow) {
    if (alert.status !== 'active') return;
    if (!bySymbol.has(alert.symbol)) bySymbol.set(alert.symbol, new Map());
    bySymbol.get(alert.symbol)!.set(alert.id, alert);
}
function unindex(alert: Pick<PriceAlertRow, 'id' | 'symbol'>) {
    const m = bySymbol.get(alert.symbol);
    if (!m) return;
    m.delete(alert.id);
    if (m.size === 0) bySymbol.delete(alert.symbol);
}

const fmt = (symbol: string, v: number) => {
    const digits = v >= 1000 ? 1 : v >= 10 ? 2 : v >= 1 ? 4 : 6;
    return `${v.toFixed(digits)}`;
};

async function defaultFire(alert: PriceAlertRow, price: number) {
    const ok = await PriceAlert.markTriggered(alert.id, price).catch(() => false);
    if (!ok) return;
    await notify(alert.userId, {
        kind: 'price_alert',
        title: `${alert.symbol} ${alert.condition === 'above' ? 'reached' : 'fell to'} ${fmt(alert.symbol, alert.price)}`,
        body: `${alert.symbol} is now ${fmt(alert.symbol, price)}${alert.note ? ` — ${alert.note}` : ''}`,
        data: { alertId: alert.id, symbol: alert.symbol, price, target: alert.price, condition: alert.condition },
    });
}

export const alertEngine = {
    /** Symbols with at least one active alert — the feed must stream these. */
    symbols(): string[] { return [...bySymbol.keys()]; },

    size(): number { let n = 0; for (const m of bySymbol.values()) n += m.size; return n; },

    async load(): Promise<number> {
        const rows = await PriceAlert.listActive();
        bySymbol.clear();
        rows.forEach(index);
        loaded = true;
        return rows.length;
    },

    isLoaded() { return loaded; },

    add(alert: PriceAlertRow) { index(alert); },
    remove(alert: Pick<PriceAlertRow, 'id' | 'symbol'>) { unindex(alert); },

    /** Called once per changed symbol on the feed's flush tick. */
    check(symbol: string, price: number, fire: Fire = defaultFire): PriceAlertRow[] {
        const m = bySymbol.get(symbol);
        if (!m) return [];
        const hits: PriceAlertRow[] = [];
        for (const alert of m.values()) {
            if (!alertHit(alert, price) || firing.has(alert.id)) continue;
            hits.push(alert);
            unindex(alert);
            firing.add(alert.id);
            Promise.resolve(fire(alert, price))
                .catch(e => console.warn('[alerts] fire failed:', e?.message))
                .finally(() => firing.delete(alert.id));
        }
        return hits;
    },

    /** For tests: drop everything. */
    reset() { bySymbol.clear(); firing.clear(); loaded = false; },
};
