/**
 * FEED BOOTSTRAP
 *
 * Builds the provider set from the environment and registers it in priority
 * order. Registration order is the routing preference:
 *
 *   1. cTrader — the broker's own bid/ask for forex, metals, energy, indices.
 *      This is the feed the account actually trades against, so it wins for
 *      everything it carries.
 *   2. Binance — crypto, streaming best bid/ask.
 *   3. Yahoo   — stocks, and a last resort for anything the broker omits.
 *
 * The same quotes serve both trading modes: the simulator marks positions off
 * them, and live cTrader orders are priced against the feed they came from.
 */

import { BinanceFeed } from './binanceFeed';
import { CTraderFeed } from './ctraderFeed';
import { YahooFeed } from './yahooFeed';
import { feedRouter, FeedRouter } from './feedRouter';
import { CTraderClient, CTraderEnvironment } from '../ctrader/connection';
import { FeedQuote } from './types';

export { feedRouter, FeedRouter };
export * from './types';

let ctraderFeed: CTraderFeed | null = null;
let started = false;

/** The cTrader feed instance, when the broker connection is configured. */
export function getCTraderFeed(): CTraderFeed | null {
    return ctraderFeed;
}

interface CTraderConfig {
    clientId: string;
    clientSecret: string;
    accessToken: string;
    accountId: number;
    environment: CTraderEnvironment;
}

type ConfigResult =
    | { ok: true; config: CTraderConfig }
    | { ok: false; missing: string[] };

function readCTraderConfig(): ConfigResult {
    const clientId = process.env.CTRADER_CLIENT_ID;
    const clientSecret = process.env.CTRADER_CLIENT_SECRET;
    const accessToken = process.env.CTRADER_ACCESS_TOKEN;
    const accountId = Number(process.env.CTRADER_ACCOUNT_ID);
    const environment = (process.env.CTRADER_ENV as CTraderEnvironment) || 'demo';

    const missing: string[] = [];
    if (!clientId) missing.push('CTRADER_CLIENT_ID');
    if (!clientSecret) missing.push('CTRADER_CLIENT_SECRET');
    if (!accessToken) missing.push('CTRADER_ACCESS_TOKEN');
    if (!Number.isFinite(accountId) || accountId <= 0) missing.push('CTRADER_ACCOUNT_ID');

    if (missing.length) return { ok: false, missing };
    if (environment !== 'demo' && environment !== 'live') {
        return { ok: false, missing: [`CTRADER_ENV must be "demo" or "live", got "${environment}"`] };
    }

    return {
        ok: true,
        config: {
            clientId: clientId!,
            clientSecret: clientSecret!,
            accessToken: accessToken!,
            accountId,
            environment,
        },
    };
}

/**
 * Wire up the feeds. Safe to call once at boot; later calls are ignored.
 * `onQuote` receives every quote from every provider, for socket fan-out.
 */
export async function initFeeds(onQuote?: (q: FeedQuote) => void): Promise<FeedRouter> {
    if (started) return feedRouter;
    started = true;

    if (onQuote) feedRouter.onQuote(onQuote);
    const publish = (q: FeedQuote) => feedRouter.publish(q);

    // ── cTrader: forex, metals, energy, indices ──
    const ct = readCTraderConfig();
    if (ct.ok) {
        const cfg = ct.config;
        const client = new CTraderClient({
            ...cfg,
            onReady: async () => {
                // A reconnect starts a fresh session with no subscriptions,
                // so the feed has to re-arm everything it was streaming.
                if (ctraderFeed) await ctraderFeed.resume();
            },
            onDisconnect: (reason) => {
                console.warn(`[cTrader] Link down: ${reason}. Serving last known quotes.`);
            },
        });
        ctraderFeed = new CTraderFeed(client, publish);
        feedRouter.register(ctraderFeed);
        console.log(`🔌 [Feed] cTrader configured (${cfg.environment}, account ${cfg.accountId}).`);
    } else {
        console.warn(
            `⚠️ [Feed] cTrader not configured — missing ${ct.missing.join(', ')}. ` +
            'Forex, metals and indices will fall back to Yahoo, which publishes a ' +
            'single delayed price rather than a tradable bid/ask.'
        );
    }

    // ── Binance: crypto ──
    feedRouter.register(new BinanceFeed(publish));

    // ── Yahoo: stocks and fallback ──
    feedRouter.register(new YahooFeed(publish));

    await feedRouter.start();
    return feedRouter;
}
