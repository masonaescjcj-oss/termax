/**
 * VENUE ROUTER
 *
 * Decides, per account, whether an order is matched by our own engine or sent
 * to the broker. The decision comes from the account record so a user can hold
 * both kinds at once:
 *
 *   accountType 'DEMO'                      -> SIMULATED
 *   accountType 'LIVE' with a cTrader link  -> CTRADER
 *
 * An account marked LIVE whose broker link is unavailable is refused rather
 * than quietly falling back to the simulator: filling a live order against a
 * simulated book would show the user a position their broker does not have.
 */

import { ExecutionVenue, VenueKind } from './types';

export interface AccountLike {
    cTraderId?: string;
    accountType?: string;
    broker?: string;
    /** Explicit override; when absent the kind is inferred from accountType. */
    venue?: VenueKind;
    /** Numeric ctidTraderAccountId, present once a real broker account is linked. */
    ctidTraderAccountId?: number | string | null;
}

/**
 * Which venue an account trades on.
 *
 * `venue` on the record wins, so an account can be pinned explicitly (useful
 * for a live account you want to paper-trade first). Otherwise LIVE accounts
 * that carry a broker account id route to cTrader and everything else is
 * simulated.
 */
export function venueKindForAccount(account: AccountLike | undefined): VenueKind {
    if (!account) return 'SIMULATED';
    if (account.venue === 'SIMULATED' || account.venue === 'CTRADER') return account.venue;

    const isLive = String(account.accountType || '').toUpperCase() === 'LIVE';
    const hasBrokerAccount = account.ctidTraderAccountId !== undefined
        && account.ctidTraderAccountId !== null
        && String(account.ctidTraderAccountId).length > 0;

    return isLive && hasBrokerAccount ? 'CTRADER' : 'SIMULATED';
}

export class VenueRouter {
    private venues = new Map<VenueKind, ExecutionVenue>();

    register(venue: ExecutionVenue): void {
        this.venues.set(venue.kind, venue);
    }

    get(kind: VenueKind): ExecutionVenue | undefined {
        return this.venues.get(kind);
    }

    /**
     * Resolve the venue for an account. Returns a reason instead of a venue
     * when the account's mode cannot currently be served.
     */
    resolve(account: AccountLike | undefined): { venue: ExecutionVenue } | { error: string } {
        const kind = venueKindForAccount(account);
        const venue = this.venues.get(kind);

        if (!venue) {
            return {
                error: kind === 'CTRADER'
                    ? 'Live trading is not configured on this server. Set the cTrader credentials to enable it.'
                    : 'The simulation engine is unavailable.',
            };
        }

        if (!venue.isAvailable()) {
            return {
                error: kind === 'CTRADER'
                    ? 'The broker connection is down. Live orders are refused until it is restored — your positions at the broker are unaffected.'
                    : 'The simulation engine is not ready yet. Please retry in a moment.',
            };
        }

        return { venue };
    }

    /** Snapshot for the status endpoint. */
    status(): Record<string, { registered: boolean; available: boolean }> {
        const out: Record<string, { registered: boolean; available: boolean }> = {};
        for (const kind of ['SIMULATED', 'CTRADER'] as VenueKind[]) {
            const v = this.venues.get(kind);
            out[kind] = { registered: !!v, available: !!v?.isAvailable() };
        }
        return out;
    }
}

/** Process-wide router shared by the trade controller and sockets. */
export const venueRouter = new VenueRouter();
