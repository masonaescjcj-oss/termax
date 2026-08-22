/**
 * VENUE BOOTSTRAP
 *
 * Registers both trading modes. The simulated venue is always available — it
 * is our own engine. The cTrader venue is registered only when the broker
 * credentials are configured, so a server without them simply has no live mode
 * rather than a broken one.
 */

import { venueRouter, VenueRouter } from './router';
import { CTraderVenue } from './ctraderVenue';
import { getCTraderFeed } from '../feeds';

export { venueRouter, VenueRouter };
export * from './types';
export { venueKindForAccount } from './router';

let initialised = false;

/**
 * Wire up the venues. Call after initFeeds() — the cTrader venue shares the
 * feed's connection and symbol map, so there is one socket to the broker, not
 * two.
 */
export function initVenues(): VenueRouter {
    if (initialised) return venueRouter;
    initialised = true;

    const feed = getCTraderFeed();
    if (feed) {
        // The feed owns the connection; reach through it so both share one
        // authenticated session and one symbol map.
        const client = (feed as any).client;
        if (client) {
            venueRouter.register(new CTraderVenue(client, feed));
            console.log('🏦 [Venue] Live cTrader execution registered.');
        }
    } else {
        console.log('🏦 [Venue] Live cTrader execution not configured — simulation only.');
    }

    return venueRouter;
}
