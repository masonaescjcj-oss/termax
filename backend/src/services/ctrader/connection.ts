/**
 * cTRADER OPEN API CONNECTION
 *
 * Open API 2.0 is protobuf over a plain TLS socket on port 5035 — not REST.
 * The repo previously carried only the OAuth half (services/ctraderService.ts
 * builds the auth URL and exchanges the code), and the callback fabricated a
 * profile with Math.random() and discarded it. This module is the missing
 * transport: application auth, account auth, heartbeat, and reconnect.
 *
 * Endpoints:
 *   demo.ctraderapi.com:5035  — demo accounts
 *   live.ctraderapi.com:5035  — live accounts
 *
 * Rate limits (per connection, from the Open API docs): 50 requests/second for
 * ordinary requests and 5/second for historical data. Spot prices arrive as
 * subscription events rather than polled requests, so streaming does not
 * consume the request budget; `withHistoricalBudget` paces the trendbar calls
 * that do.
 */

import { CTraderConnection } from '@reiryoku/ctrader-layer';

export type CTraderEnvironment = 'demo' | 'live';

const HOSTS: Record<CTraderEnvironment, string> = {
    demo: 'demo.ctraderapi.com',
    live: 'live.ctraderapi.com',
};

const PORT = 5035;

/** The docs recommend a heartbeat every 25s; 10s leaves margin on a slow link. */
const HEARTBEAT_MS = 10_000;

/** Historical-data requests are capped at 5/second per connection. */
const HISTORICAL_MIN_INTERVAL_MS = 220;

export interface CTraderCredentials {
    clientId: string;
    clientSecret: string;
    /** OAuth access token for the trading account. */
    accessToken: string;
    /** ctidTraderAccountId — numeric account id from getAccessTokenAccounts. */
    accountId: number;
}

export interface CTraderConnectionOptions extends CTraderCredentials {
    environment: CTraderEnvironment;
    /** Called after every successful (re)authentication, for resubscribing. */
    onReady?: () => void | Promise<void>;
    /** Called when the link drops, before the reconnect timer is armed. */
    onDisconnect?: (reason: string) => void;
}

type EventHandler = (payload: any) => void;

export class CTraderClient {
    private conn: CTraderConnection | null = null;
    private heartbeat: NodeJS.Timeout | null = null;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private reconnectAttempt = 0;
    private ready = false;
    private closing = false;
    private opening: Promise<void> | null = null;

    /** Handlers registered by callers, re-attached after each reconnect. */
    private handlers = new Map<string, EventHandler[]>();

    private lastHistoricalAt = 0;
    private historicalChain: Promise<unknown> = Promise.resolve();

    constructor(private readonly opts: CTraderConnectionOptions) {}

    get accountId(): number {
        return this.opts.accountId;
    }

    get environment(): CTraderEnvironment {
        return this.opts.environment;
    }

    isReady(): boolean {
        return this.ready;
    }

    /**
     * Open the socket and authenticate. Concurrent callers share one attempt,
     * so a burst of subscribe() calls at startup cannot open several sockets.
     */
    async connect(): Promise<void> {
        if (this.ready) return;
        if (this.opening) return this.opening;

        this.closing = false;
        this.opening = this.doConnect().finally(() => { this.opening = null; });
        return this.opening;
    }

    private async doConnect(): Promise<void> {
        const host = HOSTS[this.opts.environment];
        const conn = new CTraderConnection({ host, port: PORT });

        // Attach transport-level listeners before opening so a failure during
        // the handshake still routes into the reconnect path.
        this.conn = conn;
        this.attachHandlers();

        conn.on('ProtoOAAccountsTokenInvalidatedEvent', (e: any) => {
            console.error('[cTrader] Access token invalidated by the server:', e?.reason ?? '');
            this.ready = false;
            this.scheduleReconnect('token invalidated');
        });
        conn.on('ProtoOAClientDisconnectEvent', (e: any) => {
            console.warn('[cTrader] Server disconnected the client:', e?.reason ?? '');
            this.ready = false;
            this.scheduleReconnect('server disconnect');
        });

        await conn.open();

        await conn.sendCommand('ProtoOAApplicationAuthReq', {
            clientId: this.opts.clientId,
            clientSecret: this.opts.clientSecret,
        });

        await conn.sendCommand('ProtoOAAccountAuthReq', {
            accessToken: this.opts.accessToken,
            ctidTraderAccountId: this.opts.accountId,
        });

        this.ready = true;
        this.reconnectAttempt = 0;
        this.startHeartbeat();

        console.log(`✅ [cTrader] Authenticated on ${host} for account ${this.opts.accountId}`);

        try {
            await this.opts.onReady?.();
        } catch (e: any) {
            console.error('[cTrader] onReady handler failed:', e.message);
        }
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeat = setInterval(() => {
            try {
                this.conn?.sendHeartbeat();
            } catch (e: any) {
                console.warn('[cTrader] Heartbeat failed:', e.message);
                this.ready = false;
                this.scheduleReconnect('heartbeat failure');
            }
        }, HEARTBEAT_MS);
    }

    private stopHeartbeat() {
        if (this.heartbeat) {
            clearInterval(this.heartbeat);
            this.heartbeat = null;
        }
    }

    private scheduleReconnect(reason: string) {
        if (this.closing || this.reconnectTimer) return;

        this.stopHeartbeat();
        this.opts.onDisconnect?.(reason);

        // Exponential backoff to 60s. A broker that is down for maintenance
        // should not be hammered, and the engine keeps serving the last known
        // quotes meanwhile.
        const delay = Math.min(60_000, 1_000 * Math.pow(2, this.reconnectAttempt));
        this.reconnectAttempt++;

        console.warn(`[cTrader] Reconnecting in ${Math.round(delay / 1000)}s (${reason}), attempt ${this.reconnectAttempt}`);

        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            try {
                this.teardownSocket();
                await this.connect();
            } catch (e: any) {
                console.error('[cTrader] Reconnect failed:', e.message);
                this.scheduleReconnect('reconnect failed');
            }
        }, delay);
    }

    private teardownSocket() {
        try {
            this.conn?.close();
        } catch { /* already gone */ }
        this.conn = null;
        this.ready = false;
    }

    /** Register a server-event handler; survives reconnects. */
    on(payloadName: string, handler: EventHandler): void {
        const list = this.handlers.get(payloadName) ?? [];
        list.push(handler);
        this.handlers.set(payloadName, list);

        if (this.conn) this.conn.on(payloadName, handler);
    }

    private attachHandlers() {
        if (!this.conn) return;
        for (const [name, list] of this.handlers) {
            for (const handler of list) this.conn.on(name, handler);
        }
    }

    /**
     * Send a command, connecting first if necessary. A transport failure marks
     * the link down and arms the reconnect, then rethrows so the caller can
     * decide whether to retry or surface the error.
     */
    async send(payloadName: string, data: Record<string, unknown> = {}): Promise<any> {
        if (!this.ready) await this.connect();
        if (!this.conn) throw new Error('cTrader connection unavailable');

        try {
            return await this.conn.sendCommand(payloadName, {
                ctidTraderAccountId: this.opts.accountId,
                ...data,
            });
        } catch (e: any) {
            // A protocol-level rejection (bad symbol, order refused) is not a
            // transport failure — only treat it as one when the socket died.
            const message = String(e?.message ?? e);
            if (/socket|closed|ECONN|EPIPE|timeout/i.test(message)) {
                this.ready = false;
                this.scheduleReconnect(`send failure: ${message}`);
            }
            throw e;
        }
    }

    /**
     * Serialise historical-data requests to stay inside the 5/second cap.
     * Without this, backfilling a chart with several timeframes trips the
     * server's rate limiter and the requests come back as errors.
     */
    async withHistoricalBudget<T>(fn: () => Promise<T>): Promise<T> {
        const run = async (): Promise<T> => {
            const since = Date.now() - this.lastHistoricalAt;
            if (since < HISTORICAL_MIN_INTERVAL_MS) {
                await new Promise(r => setTimeout(r, HISTORICAL_MIN_INTERVAL_MS - since));
            }
            this.lastHistoricalAt = Date.now();
            return fn();
        };

        // Chain so concurrent callers queue instead of racing the interval.
        const result = this.historicalChain.then(run, run);
        this.historicalChain = result.catch(() => undefined);
        return result;
    }

    async disconnect(): Promise<void> {
        this.closing = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.stopHeartbeat();
        this.teardownSocket();
    }

    /** Accounts reachable with an access token. Plain HTTPS, no socket needed. */
    static listAccounts(accessToken: string): Promise<any[]> {
        return CTraderConnection.getAccessTokenAccounts(accessToken) as Promise<any[]>;
    }

    /** Profile behind an access token. Plain HTTPS, no socket needed. */
    static tokenProfile(accessToken: string): Promise<any> {
        return CTraderConnection.getAccessTokenProfile(accessToken);
    }
}
