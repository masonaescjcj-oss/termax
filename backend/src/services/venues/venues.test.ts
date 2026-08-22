/**
 * Venue layer tests.
 *
 * Two things here are worth pinning down hard:
 *
 *  1. Volume units. cTrader expresses volume as base-currency units x 100, so
 *     1.00 lot of EUR/USD is 10,000,000 on the wire. A factor-of-100 slip here
 *     sends an order a hundred times too large on a live account, so the
 *     conversion is asserted in both directions for several instruments.
 *
 *  2. Mode routing. A LIVE account whose broker link is down must be refused,
 *     never silently filled by the simulator — that would show the user a
 *     position their broker does not have.
 *
 * Run with:  npx ts-node src/services/venues/venues.test.ts
 */

import { getSpec } from '../../config/instruments';
import { CTraderVenue } from './ctraderVenue';
import { VenueRouter, venueKindForAccount } from './router';
import { ExecutionVenue, VenueKind } from './types';

let passed = 0;
const failures: string[] = [];

function check(name: string, got: unknown, want: unknown, tol = 0) {
    const ok = typeof got === 'number' && typeof want === 'number'
        ? Number.isFinite(got) && Math.abs(got - want) <= tol
        : got === want;
    if (ok) passed++;
    else failures.push(`${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
}
const section = (t: string) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 56 - t.length))}`);

// ── fakes ────────────────────────────────────────────────────────
class FakeClient {
    sent: { name: string; data: any }[] = [];
    handlers: ((e: any) => void)[] = [];
    ready = true;
    responses = new Map<string, any>();

    isReady() { return this.ready; }
    on(_name: string, handler: (e: any) => void) { this.handlers.push(handler); }
    emit(event: any) { for (const h of this.handlers) h(event); }
    async send(name: string, data: any = {}) {
        this.sent.push({ name, data });
        return this.responses.get(name) ?? {};
    }
    async connect() {}
    async disconnect() { this.ready = false; }
    async withHistoricalBudget<T>(fn: () => Promise<T>) { return fn(); }
    get accountId() { return 1; }
    get environment() { return 'demo' as const; }
    last(name: string) { return [...this.sent].reverse().find(c => c.name === name); }
}

/** Stands in for CTraderFeed's symbol maps. */
function fakeFeed(map: Record<string, number>) {
    const byOurSymbol = new Map(Object.entries(map).map(([s, id]) => [s, { id, name: s, digits: getSpec(s).digits }]));
    const byBrokerId = new Map(Object.entries(map).map(([s, id]) => [id, s]));
    return { byOurSymbol, byBrokerId } as any;
}

async function main() {
    // ══════════════════════════════════════════════════════════════
    section('cTrader volume units');
    // ══════════════════════════════════════════════════════════════
    {
        const client = new FakeClient();
        const feed = fakeFeed({ 'EUR/USD': 1, 'USD/JPY': 2, GOLD: 3, 'BTC/USDT': 4 });
        const venue = new CTraderVenue(client as any, feed);
        const v = venue as any;

        // EUR/USD: 100,000 units per lot, x100 => 10,000,000 for 1.00 lot.
        check('1.00 lot EUR/USD', v.toBrokerVolume('EUR/USD', 1.0), 10_000_000);
        check('0.01 lot EUR/USD', v.toBrokerVolume('EUR/USD', 0.01), 100_000);
        check('0.10 lot USD/JPY', v.toBrokerVolume('USD/JPY', 0.1), 1_000_000);
        // GOLD: 100 oz per lot => 10,000 for 1.00 lot.
        check('1.00 lot GOLD', v.toBrokerVolume('GOLD', 1.0), 10_000);
        // BTC: contract size 1 => 100 for 1.00 lot.
        check('1.00 lot BTC', v.toBrokerVolume('BTC/USDT', 1.0), 100);

        // Round-trips must be exact, or reported sizes drift from real ones.
        for (const [sym, lots] of [['EUR/USD', 1.0], ['EUR/USD', 0.37], ['GOLD', 0.05], ['BTC/USDT', 2.5]] as const) {
            check(`round trip ${lots} ${sym}`, v.toLots(sym, v.toBrokerVolume(sym, lots)), lots, 1e-9);
        }

        // Money fields arrive as hundredths of a cent.
        check('money descaled', v.money(123_456), 1234.56, 1e-9);
        check('money handles rubbish', v.money(undefined), 0);
    }

    // ══════════════════════════════════════════════════════════════
    section('order submission');
    // ══════════════════════════════════════════════════════════════
    {
        const client = new FakeClient();
        const feed = fakeFeed({ 'EUR/USD': 1 });
        const venue = new CTraderVenue(client as any, feed);

        // Confirm the order as soon as the request is recorded.
        const original = client.send.bind(client);
        client.send = async (name: string, data: any = {}) => {
            const res = await original(name, data);
            if (name === 'ProtoOANewOrderReq') {
                setImmediate(() => client.emit({
                    executionType: 'ORDER_FILLED',
                    position: {
                        positionId: 555,
                        price: 1.07501,
                        commission: 350,
                        swap: 0,
                        positionStatus: 'POSITION_STATUS_OPEN',
                        tradeData: { symbolId: 1, tradeSide: 'BUY', volume: 1_000_000, openTimestamp: 1_700_000_000_000 },
                        clientOrderId: data.clientOrderId,
                    },
                }));
            }
            return res;
        };

        const result = await venue.openOrder({
            accountId: 'acct-1', symbol: 'EUR/USD', side: 'BUY',
            volume: 0.1, kind: 'MARKET', stopLoss: 1.07000, takeProfit: 1.08000,
        });

        check('order accepted', result.ok, true);
        const sent = client.last('ProtoOANewOrderReq');
        check('volume sent in broker units', sent?.data.volume, 1_000_000);
        check('side sent', sent?.data.tradeSide, 'BUY');
        check('order type sent', sent?.data.orderType, 'MARKET');
        check('stop loss rounded to 5 digits', sent?.data.stopLoss, 1.07, 1e-9);
        check('position id mapped', result.data?.id, '555');
        check('volume mapped back to lots', result.data?.volume, 0.1, 1e-9);
        check('commission counted round turn', result.data?.commission, 7.0, 0.01);

        // A rejection must surface as an error, not a phantom position.
        const client2 = new FakeClient();
        const venue2 = new CTraderVenue(client2 as any, fakeFeed({ 'EUR/USD': 1 }));
        const orig2 = client2.send.bind(client2);
        client2.send = async (name: string, data: any = {}) => {
            const res = await orig2(name, data);
            if (name === 'ProtoOANewOrderReq') {
                setImmediate(() => client2.emit({
                    executionType: 'ORDER_REJECTED',
                    errorCode: 'NOT_ENOUGH_MONEY',
                    order: { clientOrderId: data.clientOrderId },
                }));
            }
            return res;
        };
        const rejected = await venue2.openOrder({
            accountId: 'a', symbol: 'EUR/USD', side: 'BUY', volume: 100, kind: 'MARKET',
        });
        check('rejection reported as failure', rejected.ok, false);
        check('rejection reason includes the broker code',
            /NOT_ENOUGH_MONEY/.test(rejected.error ?? ''), true);

        // A pending order needs a price.
        const noPrice = await venue.openOrder({
            accountId: 'a', symbol: 'EUR/USD', side: 'BUY', volume: 0.1, kind: 'LIMIT',
        });
        check('limit order without a price is refused', noPrice.ok, false);

        // An instrument the broker lacks must be refused clearly.
        const unknown = await venue.openOrder({
            accountId: 'a', symbol: 'NZD/USD', side: 'BUY', volume: 0.1, kind: 'MARKET',
        });
        check('unsupported symbol refused', unknown.ok, false);
        check('unsupported symbol names the instrument',
            /NZD\/USD/.test(unknown.error ?? ''), true);

        // A dead link must refuse rather than pretend.
        client.ready = false;
        const offline = await venue.openOrder({
            accountId: 'a', symbol: 'EUR/USD', side: 'BUY', volume: 0.1, kind: 'MARKET',
        });
        check('offline venue refuses the order', offline.ok, false);
        check('offline venue is unavailable', venue.isAvailable(), false);
    }

    // ══════════════════════════════════════════════════════════════
    section('reading positions back from the broker');
    // ══════════════════════════════════════════════════════════════
    {
        const client = new FakeClient();
        client.responses.set('ProtoOAReconcileReq', {
            position: [{
                positionId: 900, price: 1.07400, commission: 350, swap: -120,
                stopLoss: 1.07000, takeProfit: 1.08000,
                tradeData: { symbolId: 1, tradeSide: 'SELL', volume: 5_000_000, openTimestamp: 1_700_000_000_000 },
            }],
            order: [{
                orderId: 901, limitPrice: 1.06500,
                tradeData: { symbolId: 1, tradeSide: 'BUY', volume: 2_000_000 },
            }],
        });
        const venue = new CTraderVenue(client as any, fakeFeed({ 'EUR/USD': 1 }));
        const res = await venue.getPositions('acct-1');

        check('positions read', res.ok, true);
        check('open position and pending order both returned', res.data?.length, 2);
        const open = res.data?.find(p => p.status === 'OPEN');
        check('side read', open?.side, 'SELL');
        check('volume converted to lots', open?.volume, 0.5, 1e-9);
        check('swap carried through', open?.swap, -1.2, 0.001);
        const pending = res.data?.find(p => p.status === 'PENDING');
        check('pending order price read', pending?.entryPrice, 1.065, 1e-9);
        check('pending order volume in lots', pending?.volume, 0.2, 1e-9);
    }

    // ══════════════════════════════════════════════════════════════
    section('mode routing');
    // ══════════════════════════════════════════════════════════════
    {
        check('demo account is simulated',
            venueKindForAccount({ accountType: 'DEMO', cTraderId: 'default_demo' }), 'SIMULATED');
        check('live account with a broker id routes to cTrader',
            venueKindForAccount({ accountType: 'LIVE', ctidTraderAccountId: 12345 }), 'CTRADER');
        check('live account WITHOUT a broker id stays simulated',
            venueKindForAccount({ accountType: 'LIVE' }), 'SIMULATED');
        check('an explicit override wins',
            venueKindForAccount({ accountType: 'LIVE', ctidTraderAccountId: 1, venue: 'SIMULATED' }), 'SIMULATED');
        check('a missing account is simulated', venueKindForAccount(undefined), 'SIMULATED');

        class Stub implements ExecutionVenue {
            constructor(readonly kind: VenueKind, private up: boolean) {}
            isAvailable() { return this.up; }
            async openOrder() { return { ok: true }; }
            async closePosition() { return { ok: true }; }
            async modifyPosition() { return { ok: true }; }
            async getPositions() { return { ok: true, data: [] }; }
            async getAccount() { return { ok: true } as any; }
        }

        const router = new VenueRouter();
        router.register(new Stub('SIMULATED', true) as any);
        router.register(new Stub('CTRADER', true) as any);

        const demo = router.resolve({ accountType: 'DEMO' });
        check('demo resolves to a venue', 'venue' in demo, true);
        const live = router.resolve({ accountType: 'LIVE', ctidTraderAccountId: 9 });
        check('live resolves to a venue', 'venue' in live, true);
        check('live resolved to the cTrader venue',
            'venue' in live ? live.venue.kind : null, 'CTRADER');

        // The critical case: broker down on a live account.
        const down = new VenueRouter();
        down.register(new Stub('SIMULATED', true) as any);
        down.register(new Stub('CTRADER', false) as any);
        const refused = down.resolve({ accountType: 'LIVE', ctidTraderAccountId: 9 });
        check('live order refused when the broker is down', 'error' in refused, true);
        check('refusal explains the broker positions are untouched',
            /broker/i.test('error' in refused ? refused.error : ''), true);
        // ...while the demo account keeps working.
        check('demo still works while the broker is down',
            'venue' in down.resolve({ accountType: 'DEMO' }), true);

        // Live mode not configured at all.
        const simOnly = new VenueRouter();
        simOnly.register(new Stub('SIMULATED', true) as any);
        const unconfigured = simOnly.resolve({ accountType: 'LIVE', ctidTraderAccountId: 9 });
        check('unconfigured live mode is refused', 'error' in unconfigured, true);
        check('status reports both modes', Object.keys(simOnly.status()).length, 2);
        check('status marks cTrader unregistered', simOnly.status().CTRADER.registered, false);
    }
}

main().then(() => {
    console.log(`\n${'═'.repeat(62)}`);
    if (failures.length === 0) {
        console.log(`✅ all ${passed} assertions passed`);
        process.exit(0);
    }
    console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}\n`));
    process.exit(1);
}).catch(e => { console.error('FATAL', e); process.exit(1); });
