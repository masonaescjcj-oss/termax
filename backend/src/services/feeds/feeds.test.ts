/**
 * Feed layer tests.
 *
 * The cTrader Open API speaks protobuf over TLS on port 5035 and Binance
 * streams over a WebSocket, neither of which this build environment can reach.
 * So the wire format and the routing decisions are tested against a fake
 * connection instead: the encodings that are easy to get wrong (spot events
 * scaled by 10^digits, trendbars stored as a low plus integer deltas, cTrader
 * volume units) are exactly what these assertions pin down.
 *
 * Run with:  npx ts-node src/services/feeds/feeds.test.ts
 */

import { getSpec, applyBrokerSpec } from '../../config/instruments';
import { __resetQuotes, getQuote, getSpreadPips } from '../pricing';
import { CTraderFeed } from './ctraderFeed';
import { FeedRouter } from './feedRouter';
import { FeedQuote, MarketFeed, FeedStatus, Candle, Timeframe } from './types';
import { AssetClass } from '../../config/instruments';

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

// ── a fake CTraderClient that records commands and replays canned responses ──
class FakeClient {
    sent: { name: string; data: any }[] = [];
    handlers = new Map<string, (p: any) => void>();
    responses = new Map<string, any>();
    ready = true;

    isReady() { return this.ready; }
    async connect() { /* already "connected" */ }
    async disconnect() { this.ready = false; }
    on(name: string, handler: (p: any) => void) { this.handlers.set(name, handler); }
    emit(name: string, payload: any) { this.handlers.get(name)?.(payload); }

    async send(name: string, data: any = {}) {
        this.sent.push({ name, data });
        if (this.responses.has(name)) return this.responses.get(name);
        return {};
    }
    async withHistoricalBudget<T>(fn: () => Promise<T>) { return fn(); }
    get accountId() { return 123; }
    get environment() { return 'demo' as const; }
}

async function main() {
    // ══════════════════════════════════════════════════════════════════
    section('cTrader symbol matching');
    // ══════════════════════════════════════════════════════════════════
    {
        const fake = new FakeClient();
        // Broker names differ from ours: XAUUSD for gold, US500 for the S&P,
        // and a ".pro" suffix on majors.
        fake.responses.set('ProtoOASymbolsListReq', {
            symbol: [
                { symbolId: 1, symbolName: 'EURUSD', digits: 5, pipPosition: 4 },
                { symbolId: 2, symbolName: 'USDJPY', digits: 3, pipPosition: 2 },
                { symbolId: 3, symbolName: 'XAUUSD', digits: 2, pipPosition: 2 },
                { symbolId: 4, symbolName: 'US500', digits: 1, pipPosition: 1 },
                { symbolId: 5, symbolName: 'GBPUSD.pro', digits: 5, pipPosition: 4 },
            ],
        });
        fake.responses.set('ProtoOASymbolByIdReq', { symbol: [] });

        const quotes: FeedQuote[] = [];
        const feed = new CTraderFeed(fake as any, q => quotes.push(q));
        await feed.start();

        check('EUR/USD matched directly', feed.supports('EUR/USD'), true);
        check('USD/JPY matched directly', feed.supports('USD/JPY'), true);
        check('GOLD matched via XAUUSD alias', feed.supports('GOLD'), true);
        check('SPX matched via US500 alias', feed.supports('SPX'), true);
        check('GBP/USD matched through a broker suffix', feed.supports('GBP/USD'), true);
        check('an instrument the broker lacks is not supported', feed.supports('NZD/USD'), false);

        // ── spot events ──
        __resetQuotes();
        await feed.subscribe(['EUR/USD', 'USD/JPY', 'GOLD']);
        const sub = fake.sent.find(c => c.name === 'ProtoOASubscribeSpotsReq');
        check('subscribe sends the broker symbol ids', JSON.stringify(sub?.data.symbolId), JSON.stringify([1, 2, 3]));

        // EUR/USD has 5 digits, so 107501 means 1.07501.
        fake.emit('ProtoOASpotEvent', { symbolId: 1, bid: 107500, ask: 107501, timestamp: 1_700_000_000_000 });
        check('spot event is descaled by 10^digits', getQuote('EUR/USD')?.bid, 1.07500, 1e-9);
        check('spot ask descaled', getQuote('EUR/USD')?.ask, 1.07501, 1e-9);
        check('spread reads 0.1 pip', getSpreadPips('EUR/USD')!, 0.1, 1e-6);
        check('listener received the quote', quotes.length, 1);

        // USD/JPY has 3 digits: 158501 means 158.501.
        fake.emit('ProtoOASpotEvent', { symbolId: 2, bid: 158500, ask: 158502 });
        check('JPY pair descaled at 3 digits', getQuote('USD/JPY')?.bid, 158.500, 1e-9);

        // A one-sided event must keep the other side, not invent one.
        fake.emit('ProtoOASpotEvent', { symbolId: 1, bid: 107495 });
        check('one-sided event updates the bid', getQuote('EUR/USD')?.bid, 1.07495, 1e-9);
        check('one-sided event preserves the ask', getQuote('EUR/USD')?.ask, 1.07501, 1e-9);

        // An unknown symbol id must be ignored, not throw.
        fake.emit('ProtoOASpotEvent', { symbolId: 999, bid: 1, ask: 2 });
        check('unknown symbol id ignored', getQuote('EUR/USD')?.bid, 1.07495, 1e-9);

        // A zero/absent price must not overwrite a good quote.
        fake.emit('ProtoOASpotEvent', { symbolId: 1, bid: 0, ask: 0 });
        check('zero prices rejected', getQuote('EUR/USD')?.bid, 1.07495, 1e-9);
    }

    // ══════════════════════════════════════════════════════════════════
    section('cTrader contract terms override our defaults');
    // ══════════════════════════════════════════════════════════════════
    {
        const fake = new FakeClient();
        fake.responses.set('ProtoOASymbolsListReq', {
            symbol: [{ symbolId: 10, symbolName: 'EURUSD', digits: 5, pipPosition: 4 }],
        });
        // The broker reports lot size and volume limits in its own units.
        fake.responses.set('ProtoOASymbolByIdReq', {
            symbol: [{
                symbolId: 10,
                lotSize: 100_000,
                minVolume: 100_000,     // 0.01 lots
                maxVolume: 1_000_000_000, // 100 lots
                stepVolume: 100_000,    // 0.01 lots
            }],
        });

        const feed = new CTraderFeed(fake as any);
        await feed.start();

        const spec = getSpec('EUR/USD');
        check('broker lot size adopted', spec.contractSize, 100_000);
        check('broker min volume adopted', spec.minVolume, 0.01, 1e-9);
        check('broker max volume adopted', spec.maxVolume, 100, 1e-9);
        check('broker volume step adopted', spec.volumeStep, 0.01, 1e-9);
        check('pip size derived from pipPosition', spec.pipSize, 0.0001, 1e-12);
    }

    // ══════════════════════════════════════════════════════════════════
    section('cTrader trendbar decoding');
    // ══════════════════════════════════════════════════════════════════
    {
        const fake = new FakeClient();
        fake.responses.set('ProtoOASymbolsListReq', {
            symbol: [{ symbolId: 20, symbolName: 'EURUSD', digits: 5, pipPosition: 4 }],
        });
        fake.responses.set('ProtoOASymbolByIdReq', { symbol: [] });
        // Trendbars store a low, then open/high/close as integer deltas above it,
        // all scaled by 10^5, with the bar start in minutes.
        fake.responses.set('ProtoOAGetTrendbarsReq', {
            trendbar: [
                { utcTimestampInMinutes: 28_000_000, low: 107_000, deltaOpen: 200, deltaHigh: 500, deltaClose: 300, volume: 1234 },
                { utcTimestampInMinutes: 28_000_060, low: 107_100, deltaOpen: 100, deltaHigh: 400, deltaClose: 250, volume: 987 },
            ],
        });

        const feed = new CTraderFeed(fake as any);
        await feed.start();
        const candles = await feed.getCandles('EUR/USD', '1h', 10);

        check('two candles returned', candles?.length, 2);
        check('low descaled', candles![0].low, 1.07000, 1e-9);
        check('open = low + deltaOpen', candles![0].open, 1.07200, 1e-9);
        check('high = low + deltaHigh', candles![0].high, 1.07500, 1e-9);
        check('close = low + deltaClose', candles![0].close, 1.07300, 1e-9);
        check('timestamp converted from minutes', candles![0].time, 28_000_000 * 60_000);
        check('candles are ordered oldest first', candles![0].time < candles![1].time, true);
        check('an unmatched symbol yields null', await feed.getCandles('NZD/USD', '1h', 10), null);
        check('an unsupported timeframe yields null', await feed.getCandles('EUR/USD', '2h' as Timeframe, 10), null);
    }

    // ══════════════════════════════════════════════════════════════════
    section('router sends each asset class to the right provider');
    // ══════════════════════════════════════════════════════════════════
    {
        class StubFeed implements MarketFeed {
            subscribed: string[] = [];
            constructor(
                readonly name: string,
                readonly handles: AssetClass[],
                private readonly carries: (s: string) => boolean,
                private connected = true
            ) {}
            async start() {}
            async stop() {}
            isConnected() { return this.connected; }
            setConnected(v: boolean) { this.connected = v; }
            supports(s: string) { return this.carries(s); }
            async subscribe(symbols: string[]) { this.subscribed.push(...symbols); }
            async unsubscribe(symbols: string[]) {
                this.subscribed = this.subscribed.filter(s => !symbols.includes(s));
            }
            async getCandles(): Promise<Candle[] | null> { return null; }
            status(): FeedStatus {
                return { name: this.name, connected: this.connected, subscribed: this.subscribed, lastQuoteAt: null };
            }
        }

        const router = new FeedRouter();
        const ct = new StubFeed('ctrader', ['FOREX', 'METAL', 'ENERGY', 'INDEX'],
            s => ['EUR/USD', 'USD/JPY', 'GOLD', 'SPX'].includes(s));
        const bn = new StubFeed('binance', ['CRYPTO'], s => /\/(USDT|USD|BTC)$/.test(s));
        const yh = new StubFeed('yahoo', ['STOCK', 'INDEX', 'METAL', 'ENERGY', 'FOREX'], () => true);
        router.register(ct); router.register(bn); router.register(yh);

        await router.subscribe(['EUR/USD', 'GOLD', 'BTC/USDT', 'AAPL', 'NZD/USD']);

        check('forex routed to cTrader', ct.subscribed.includes('EUR/USD'), true);
        check('metals routed to cTrader', ct.subscribed.includes('GOLD'), true);
        check('crypto routed to Binance', bn.subscribed.includes('BTC/USDT'), true);
        check('crypto NOT routed to cTrader', ct.subscribed.includes('BTC/USDT'), false);
        check('stocks routed to Yahoo', yh.subscribed.includes('AAPL'), true);
        // The broker does not carry NZD/USD, so it must fall through rather than
        // being left unpriced.
        check('a pair the broker lacks falls back to Yahoo', yh.subscribed.includes('NZD/USD'), true);
        check('provider lookup reports the route', router.providerFor('EUR/USD'), 'ctrader');
        check('provider lookup for crypto', router.providerFor('BTC/USDT'), 'binance');

        await router.unsubscribe(['EUR/USD']);
        check('unsubscribe removes from the routed feed', ct.subscribed.includes('EUR/USD'), false);

        // When the broker link is down, a new subscription must still get priced.
        ct.setConnected(false);
        await router.subscribe(['USD/JPY']);
        check('a disconnected broker feed still routes when it is the only carrier',
            ct.subscribed.includes('USD/JPY') || yh.subscribed.includes('USD/JPY'), true);

        const status = router.status();
        check('status lists every feed', status.feeds.length, 3);
    }

}

// ── report ────────────────────────────────────────────────────────
main().then(() => {
    console.log(`\n${'═'.repeat(62)}`);
    if (failures.length === 0) {
        console.log(`✅ all ${passed} assertions passed`);
        process.exit(0);
    }
    console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}\n`));
    process.exit(1);
}).catch(e => {
    console.error('FATAL', e);
    process.exit(1);
});
