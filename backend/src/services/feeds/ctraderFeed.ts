/**
 * cTRADER MARKET FEED
 *
 * Streams the broker's own bid/ask for forex, metals, energy and indices, and
 * serves chart candles from the broker's trendbars — so the chart and the
 * execution price finally come from the same place. Previously charts came
 * from Binance/Yahoo while fills came from a separate synthesised mid price.
 *
 * It also pulls each instrument's real contract terms (lot size, digits, pip
 * position, volume limits, commission, swap) via ProtoOASymbolByIdReq and
 * overlays them onto config/instruments.ts. That means the engine trades on
 * the broker's terms rather than on our defaults.
 */

import { AssetClass, applyBrokerSpec, getSpec } from '../../config/instruments';
import { setQuote } from '../pricing';
import { CTraderClient } from '../ctrader/connection';
import { Candle, FeedStatus, MarketFeed, QuoteListener, Timeframe } from './types';

/** Open API trendbar period names, keyed by our timeframe strings. */
const TRENDBAR_PERIOD: Record<Timeframe, string> = {
    '1m': 'M1',
    '5m': 'M5',
    '15m': 'M15',
    '30m': 'M30',
    '1h': 'H1',
    '4h': 'H4',
    '1d': 'D1',
    '1w': 'W1',
};

/** Approximate bar length, used to bound a trendbar request's time window. */
const TIMEFRAME_MS: Record<Timeframe, number> = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
    '4h': 14_400_000,
    '1d': 86_400_000,
    '1w': 604_800_000,
};

/**
 * Our symbol names versus the broker's. Brokers vary — "GOLD" may be "XAUUSD",
 * indices carry suffixes — so matching is done on a normalised form and this
 * table only covers the cases normalisation cannot reach.
 */
const SYMBOL_ALIASES: Record<string, string[]> = {
    GOLD: ['XAUUSD', 'GOLD', 'XAU/USD'],
    SILVER: ['XAGUSD', 'SILVER', 'XAG/USD'],
    USOIL: ['XTIUSD', 'USOIL', 'WTI', 'CRUDEOIL', 'USOUSD'],
    'NG=F': ['XNGUSD', 'NATGAS', 'NGAS'],
    'PL=F': ['XPTUSD', 'PLATINUM'],
    'PA=F': ['XPDUSD', 'PALLADIUM'],
    'HG=F': ['XCUUSD', 'COPPER'],
    SPX: ['US500', 'SPX500', 'USSPX500', 'SP500'],
    NDQ: ['US100', 'NAS100', 'USTEC', 'NASDAQ100'],
    DJI: ['US30', 'US30USD', 'DOW30', 'WS30'],
    DAX: ['DE40', 'GER40', 'DE30', 'GER30'],
    FTSE: ['UK100'],
    N225: ['JP225', 'JPN225'],
    VIX: ['VIX', 'VIXX'],
    DXY: ['USDX', 'DXY'],
};

/** Strip punctuation so "EUR/USD", "EURUSD" and "EUR_USD" compare equal. */
const normalise = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Trendbar prices arrive as integers scaled by 10^5 across all instruments. */
const TRENDBAR_SCALE = 100_000;

interface BrokerSymbol {
    id: number;
    name: string;
    digits: number;
    /** Broker's lot size in base-currency units, when it reports one. */
    lotSize?: number;
    pipPosition?: number;
    minVolume?: number;
    maxVolume?: number;
    stepVolume?: number;
}

export class CTraderFeed implements MarketFeed {
    readonly name = 'ctrader';
    readonly handles: AssetClass[] = ['FOREX', 'METAL', 'ENERGY', 'INDEX'];

    private byOurSymbol = new Map<string, BrokerSymbol>();
    private byBrokerId = new Map<number, string>();
    private subscribed = new Set<string>();
    private lastQuoteAt: number | null = null;
    private lastError: string | undefined;
    private symbolsLoaded = false;

    constructor(
        /** Shared with CTraderVenue so both use one authenticated session. */
        readonly client: CTraderClient,
        private readonly onQuote?: QuoteListener
    ) {}

    isConnected(): boolean {
        return this.client.isReady();
    }

    async start(): Promise<void> {
        this.client.on('ProtoOASpotEvent', (e: any) => this.handleSpot(e));

        // Resubscribe after a reconnect — subscriptions live on the session.
        await this.client.connect();
        await this.loadSymbols();
    }

    async stop(): Promise<void> {
        this.subscribed.clear();
        await this.client.disconnect();
    }

    /**
     * Re-arm everything after a reconnect. The connection calls this through
     * its onReady hook, because a new session starts with no subscriptions.
     */
    async resume(): Promise<void> {
        this.symbolsLoaded = false;
        await this.loadSymbols();
        const wanted = Array.from(this.subscribed);
        this.subscribed.clear();
        if (wanted.length) await this.subscribe(wanted);
    }

    supports(symbol: string): boolean {
        return this.byOurSymbol.has(symbol);
    }

    /**
     * Fetch the broker's symbol list, match it to our instruments, and adopt
     * the broker's contract terms where it reports them.
     */
    private async loadSymbols(): Promise<void> {
        if (this.symbolsLoaded) return;

        let list: any;
        try {
            list = await this.client.send('ProtoOASymbolsListReq', { includeArchivedSymbols: false });
        } catch (e: any) {
            this.lastError = `symbol list failed: ${e.message}`;
            console.error('[cTrader] Could not load symbol list:', e.message);
            return;
        }

        const brokerSymbols: any[] = list?.symbol ?? [];
        if (!brokerSymbols.length) {
            this.lastError = 'broker returned an empty symbol list';
            return;
        }

        // Index the broker's names once, then resolve each of ours against it.
        const index = new Map<string, any>();
        for (const s of brokerSymbols) {
            if (s?.symbolName) index.set(normalise(s.symbolName), s);
        }

        const matched: string[] = [];
        const unmatched: string[] = [];

        for (const ourSymbol of this.ourSymbolsForThisFeed()) {
            const candidates = [ourSymbol, ...(SYMBOL_ALIASES[ourSymbol] ?? [])].map(normalise);
            let found: any | undefined;
            for (const c of candidates) {
                found = index.get(c);
                if (found) break;
            }
            if (!found) {
                // Indices and metals often carry a broker suffix (US500.cash,
                // XAUUSD.pro), so fall back to a prefix match.
                for (const c of candidates) {
                    for (const [key, value] of index) {
                        if (key.startsWith(c) && key.length - c.length <= 4) { found = value; break; }
                    }
                    if (found) break;
                }
            }

            if (!found) { unmatched.push(ourSymbol); continue; }

            this.byOurSymbol.set(ourSymbol, {
                id: Number(found.symbolId),
                name: found.symbolName,
                digits: Number(found.digits ?? getSpec(ourSymbol).digits),
                pipPosition: found.pipPosition !== undefined ? Number(found.pipPosition) : undefined,
            });
            this.byBrokerId.set(Number(found.symbolId), ourSymbol);
            matched.push(ourSymbol);
        }

        this.symbolsLoaded = true;
        console.log(`📈 [cTrader] Matched ${matched.length} instruments on the broker feed.`);
        if (unmatched.length) {
            console.warn(`[cTrader] Not offered by this broker: ${unmatched.join(', ')}`);
        }

        await this.adoptBrokerSpecs(matched);
    }

    /** Which of our instruments this feed is responsible for. */
    private ourSymbolsForThisFeed(): string[] {
        const { allSymbols } = require('../../config/instruments') as typeof import('../../config/instruments');
        return allSymbols().filter(s => this.handles.includes(getSpec(s).assetClass));
    }

    /**
     * Replace our default contract terms with the broker's, so margin, pip
     * value and volume limits match what the account is really traded on.
     */
    private async adoptBrokerSpecs(symbols: string[]): Promise<void> {
        const ids = symbols
            .map(s => this.byOurSymbol.get(s)?.id)
            .filter((v): v is number => typeof v === 'number');
        if (!ids.length) return;

        let detail: any;
        try {
            detail = await this.client.send('ProtoOASymbolByIdReq', { symbolId: ids });
        } catch (e: any) {
            console.warn('[cTrader] Could not read contract details, keeping defaults:', e.message);
            return;
        }

        let adopted = 0;
        for (const d of (detail?.symbol ?? []) as any[]) {
            const ourSymbol = this.byBrokerId.get(Number(d.symbolId));
            if (!ourSymbol) continue;

            const patch: Record<string, unknown> = {};

            // lotSize is in base-currency units per lot — exactly contractSize.
            if (Number(d.lotSize) > 0) patch.contractSize = Number(d.lotSize);

            const digits = this.byOurSymbol.get(ourSymbol)?.digits;
            if (typeof digits === 'number' && digits > 0) patch.digits = digits;

            // pipPosition is the decimal place of a pip, so pipSize = 10^-p.
            const pipPosition = this.byOurSymbol.get(ourSymbol)?.pipPosition;
            if (typeof pipPosition === 'number' && pipPosition >= 0) {
                patch.pipSize = Math.pow(10, -pipPosition);
            }

            // Volumes are reported in hundredths of a lot (centilots * 100).
            if (Number(d.minVolume) > 0) patch.minVolume = Number(d.minVolume) / 10_000_000;
            if (Number(d.maxVolume) > 0) patch.maxVolume = Number(d.maxVolume) / 10_000_000;
            if (Number(d.stepVolume) > 0) patch.volumeStep = Number(d.stepVolume) / 10_000_000;

            // Swap is quoted in points per lot per night; convert to a rate.
            if (d.swapLong !== undefined) patch.swapLongRate = Number(d.swapLong) / 10_000;
            if (d.swapShort !== undefined) patch.swapShortRate = Number(d.swapShort) / 10_000;

            if (Object.keys(patch).length) {
                applyBrokerSpec(ourSymbol, patch as any);
                adopted++;
            }
        }

        if (adopted) {
            console.log(`📐 [cTrader] Adopted broker contract terms for ${adopted} instruments.`);
        }
    }

    async subscribe(symbols: string[]): Promise<void> {
        await this.loadSymbols();

        const ids: number[] = [];
        for (const s of symbols) {
            if (this.subscribed.has(s)) continue;
            const mapped = this.byOurSymbol.get(s);
            if (!mapped) continue;
            ids.push(mapped.id);
            this.subscribed.add(s);
        }
        if (!ids.length) return;

        try {
            await this.client.send('ProtoOASubscribeSpotsReq', { symbolId: ids });
            console.log(`📡 [cTrader] Streaming ${ids.length} symbol(s).`);
        } catch (e: any) {
            // Roll the bookkeeping back so a retry can succeed.
            for (const s of symbols) this.subscribed.delete(s);
            this.lastError = `subscribe failed: ${e.message}`;
            throw e;
        }
    }

    async unsubscribe(symbols: string[]): Promise<void> {
        const ids: number[] = [];
        for (const s of symbols) {
            const mapped = this.byOurSymbol.get(s);
            if (mapped && this.subscribed.delete(s)) ids.push(mapped.id);
        }
        if (!ids.length) return;
        try {
            await this.client.send('ProtoOAUnsubscribeSpotsReq', { symbolId: ids });
        } catch (e: any) {
            console.warn('[cTrader] Unsubscribe failed:', e.message);
        }
    }

    /**
     * A spot event carries whichever side moved, scaled by 10^digits, so the
     * other side is carried over from the last known quote. Emitting a quote
     * with only one real side would make the spread look absurd.
     */
    private handleSpot(event: any): void {
        const ourSymbol = this.byBrokerId.get(Number(event?.symbolId));
        if (!ourSymbol) return;

        const mapped = this.byOurSymbol.get(ourSymbol);
        const scale = Math.pow(10, mapped?.digits ?? getSpec(ourSymbol).digits);

        const { getQuote } = require('../pricing') as typeof import('../pricing');
        const previous = getQuote(ourSymbol);

        const bid = event.bid !== undefined ? Number(event.bid) / scale : previous?.bid;
        const ask = event.ask !== undefined ? Number(event.ask) / scale : previous?.ask;

        if (!(bid && bid > 0) || !(ask && ask > 0)) return;

        const ts = event.timestamp ? Number(event.timestamp) : Date.now();
        try {
            setQuote(ourSymbol, bid, ask, ts);
        } catch {
            return; // rejected by the quote store (inverted or non-positive)
        }

        this.lastQuoteAt = Date.now();
        this.lastError = undefined;
        this.onQuote?.({ symbol: ourSymbol, bid, ask, ts });
    }

    async getCandles(symbol: string, timeframe: Timeframe, limit: number): Promise<Candle[] | null> {
        await this.loadSymbols();
        const mapped = this.byOurSymbol.get(symbol);
        if (!mapped) return null;

        const period = TRENDBAR_PERIOD[timeframe];
        if (!period) return null;

        const to = Date.now();
        // Ask for a generous window — the broker returns what it has, and
        // weekends/holidays mean bar count is not proportional to elapsed time.
        const from = to - TIMEFRAME_MS[timeframe] * Math.max(limit * 3, 100);

        let res: any;
        try {
            res = await this.client.withHistoricalBudget(() =>
                this.client.send('ProtoOAGetTrendbarsReq', {
                    symbolId: mapped.id,
                    period,
                    fromTimestamp: from,
                    toTimestamp: to,
                })
            );
        } catch (e: any) {
            console.warn(`[cTrader] Trendbars for ${symbol} ${timeframe} failed:`, e.message);
            return null;
        }

        const bars: any[] = res?.trendbar ?? [];
        if (!bars.length) return null;

        // Trendbars are encoded as a low price plus deltas, all as integers
        // scaled by 10^5, with the period start in minutes.
        const candles: Candle[] = bars.map((b: any) => {
            const low = Number(b.low) / TRENDBAR_SCALE;
            return {
                time: Number(b.utcTimestampInMinutes) * 60_000,
                open: low + Number(b.deltaOpen ?? 0) / TRENDBAR_SCALE,
                high: low + Number(b.deltaHigh ?? 0) / TRENDBAR_SCALE,
                low,
                close: low + Number(b.deltaClose ?? 0) / TRENDBAR_SCALE,
                volume: Number(b.volume ?? 0),
            };
        });

        candles.sort((a, b) => a.time - b.time);
        return candles.slice(-limit);
    }

    status(): FeedStatus {
        return {
            name: this.name,
            connected: this.isConnected(),
            subscribed: Array.from(this.subscribed),
            lastQuoteAt: this.lastQuoteAt,
            error: this.lastError,
        };
    }
}
