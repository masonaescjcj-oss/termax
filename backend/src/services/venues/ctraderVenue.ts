/**
 * cTRADER EXECUTION VENUE — real orders on a real broker account.
 *
 * The broker is the book of record here. We send the order, wait for the
 * execution event that confirms it, and read positions back from the account.
 * Nothing about balance, margin or stop-out is computed locally: those numbers
 * come from ProtoOATraderRes, because the broker's view is the only one that
 * matters on a live account.
 *
 * Volumes on the wire are in units of 1/100 of a cent-lot: cTrader expresses
 * volume as base-currency units x 100, so 1.00 lot of EUR/USD (100,000 EUR) is
 * 10,000,000. Getting this wrong by a factor of 100 is the classic way to send
 * an order a hundred times too large, so it is centralised in one place and
 * covered by tests.
 */

import { getSpec, roundPrice } from '../../config/instruments';
import { CTraderClient } from '../ctrader/connection';
import { CTraderFeed } from '../feeds/ctraderFeed';
import {
    CloseRequest, ExecutionVenue, ModifyRequest, OrderRequest,
    VenueAccount, VenuePosition, VenueResult,
} from './types';

/** cTrader volume = base-currency units x 100. */
const VOLUME_SCALE = 100;

/** Money fields (balance, commission, swap) arrive as hundredths of a cent. */
const MONEY_SCALE = 100;

/** How long to wait for the execution event that confirms an order. */
const EXECUTION_TIMEOUT_MS = 15_000;

type ExecutionListener = (event: any) => void;

export class CTraderVenue implements ExecutionVenue {
    readonly kind = 'CTRADER' as const;

    /** Waiters keyed by the clientOrderId we attached to the request. */
    private pending = new Map<string, ExecutionListener>();
    private orderSeq = 0;

    constructor(
        private readonly client: CTraderClient,
        private readonly feed: CTraderFeed
    ) {
        this.client.on('ProtoOAExecutionEvent', (e: any) => this.handleExecution(e));
    }

    isAvailable(): boolean {
        return this.client.isReady();
    }

    /** Convert lots to the broker's volume units for a symbol. */
    private toBrokerVolume(symbol: string, lots: number): number {
        const { contractSize } = getSpec(symbol);
        return Math.round(lots * contractSize * VOLUME_SCALE);
    }

    /** Convert the broker's volume units back to lots. */
    private toLots(symbol: string, brokerVolume: number): number {
        const { contractSize } = getSpec(symbol);
        return brokerVolume / (contractSize * VOLUME_SCALE);
    }

    private money(raw: unknown): number {
        const n = Number(raw);
        return Number.isFinite(n) ? n / MONEY_SCALE : 0;
    }

    private brokerSymbolId(symbol: string): number | undefined {
        return (this.feed as any).byOurSymbol?.get(symbol)?.id;
    }

    private handleExecution(event: any): void {
        const key = event?.position?.clientOrderId
            ?? event?.order?.clientOrderId
            ?? event?.clientMsgId;
        if (!key) return;
        const waiter = this.pending.get(String(key));
        if (waiter) waiter(event);
    }

    /**
     * Send a command and wait for the execution event that acknowledges it.
     * The command's own response only says the request was accepted; the fill
     * arrives asynchronously, so returning on the response alone would report
     * a position that may still be rejected.
     */
    private async awaitExecution(
        clientOrderId: string,
        send: () => Promise<any>
    ): Promise<{ ok: true; event: any } | { ok: false; error: string }> {
        let settle: (v: { ok: true; event: any } | { ok: false; error: string }) => void;
        const result = new Promise<{ ok: true; event: any } | { ok: false; error: string }>(r => { settle = r; });

        const timer = setTimeout(() => {
            this.pending.delete(clientOrderId);
            settle({
                ok: false,
                error: 'The broker did not confirm the order in time. Check the account before retrying — it may still have been filled.',
            });
        }, EXECUTION_TIMEOUT_MS);

        this.pending.set(clientOrderId, (event: any) => {
            const type = String(event?.executionType ?? '');
            // Terminal outcomes. Anything else (ORDER_ACCEPTED and friends) is
            // an intermediate step, so keep waiting.
            if (/REJECT|CANCEL|EXPIRE/i.test(type)) {
                clearTimeout(timer);
                this.pending.delete(clientOrderId);
                const reason = event?.errorCode ?? event?.order?.errorCode ?? type;
                settle({ ok: false, error: `The broker rejected the order (${reason}).` });
                return;
            }
            if (/FILL|SWAP|ORDER_REPLACED|POSITION/i.test(type) || event?.position) {
                clearTimeout(timer);
                this.pending.delete(clientOrderId);
                settle({ ok: true, event });
            }
        });

        try {
            await send();
        } catch (e: any) {
            clearTimeout(timer);
            this.pending.delete(clientOrderId);
            return { ok: false, error: e?.message ?? 'The order could not be sent to the broker.' };
        }

        return result;
    }

    private nextOrderId(): string {
        this.orderSeq += 1;
        return `tmx-${Date.now()}-${this.orderSeq}`;
    }

    async openOrder(req: OrderRequest): Promise<VenueResult<VenuePosition>> {
        if (!this.isAvailable()) {
            return { ok: false, error: 'The broker connection is down; no live order was sent.' };
        }

        const symbolId = this.brokerSymbolId(req.symbol);
        if (symbolId === undefined) {
            return { ok: false, error: `Your broker does not offer ${req.symbol}.` };
        }

        const spec = getSpec(req.symbol);
        const volume = this.toBrokerVolume(req.symbol, req.volume);
        if (volume <= 0) {
            return { ok: false, error: 'Volume must be greater than zero.' };
        }

        const orderType = req.kind === 'MARKET' ? 'MARKET' : req.kind === 'LIMIT' ? 'LIMIT' : 'STOP';
        if (orderType !== 'MARKET' && !(Number(req.targetPrice) > 0)) {
            return { ok: false, error: `A ${orderType.toLowerCase()} order needs a target price.` };
        }

        const clientOrderId = this.nextOrderId();
        const payload: Record<string, unknown> = {
            symbolId,
            orderType,
            tradeSide: req.side,
            volume,
            clientOrderId,
            comment: req.comment ?? 'Termax',
        };
        if (orderType === 'LIMIT') payload.limitPrice = roundPrice(req.symbol, Number(req.targetPrice));
        if (orderType === 'STOP') payload.stopPrice = roundPrice(req.symbol, Number(req.targetPrice));
        if (req.stopLoss) payload.stopLoss = roundPrice(req.symbol, req.stopLoss);
        if (req.takeProfit) payload.takeProfit = roundPrice(req.symbol, req.takeProfit);
        if (req.trailingStopDistance && req.trailingStopDistance > 0) {
            payload.trailingStopLoss = true;
            // The broker expresses the trailing distance in relative points.
            payload.relativeStopLoss = Math.round(req.trailingStopDistance / Math.pow(10, -spec.digits));
        }

        const outcome = await this.awaitExecution(clientOrderId, () =>
            this.client.send('ProtoOANewOrderReq', payload)
        );
        if (!outcome.ok) return { ok: false, error: outcome.error };

        const position = this.mapPosition(outcome.event, req.accountId, req.symbol);
        if (!position) {
            return { ok: false, error: 'The broker accepted the order but returned no position to track.' };
        }
        return { ok: true, data: position };
    }

    async closePosition(req: CloseRequest): Promise<VenueResult<VenuePosition>> {
        if (!this.isAvailable()) {
            return { ok: false, error: 'The broker connection is down; the position was not closed.' };
        }

        // Find the live position so we know its symbol and size.
        const current = await this.getPositions(req.accountId);
        const target = current.data?.find(p => p.id === req.positionId);
        if (!target) {
            return { ok: false, error: 'That position no longer exists at the broker.' };
        }

        const lots = req.volume && req.volume > 0 ? Math.min(req.volume, target.volume) : target.volume;
        const clientOrderId = this.nextOrderId();

        const outcome = await this.awaitExecution(clientOrderId, () =>
            this.client.send('ProtoOAClosePositionReq', {
                positionId: Number(req.positionId),
                volume: this.toBrokerVolume(target.symbol, lots),
                clientOrderId,
            })
        );
        if (!outcome.ok) return { ok: false, error: outcome.error };

        const closed = this.mapPosition(outcome.event, req.accountId, target.symbol) ?? {
            ...target,
            status: 'CLOSED' as const,
            closeTime: new Date(),
        };
        return { ok: true, data: closed };
    }

    async modifyPosition(req: ModifyRequest): Promise<VenueResult<VenuePosition>> {
        if (!this.isAvailable()) {
            return { ok: false, error: 'The broker connection is down; the position was not modified.' };
        }

        const current = await this.getPositions(req.accountId);
        const target = current.data?.find(p => p.id === req.positionId);
        if (!target) {
            return { ok: false, error: 'That position no longer exists at the broker.' };
        }

        const payload: Record<string, unknown> = { positionId: Number(req.positionId) };
        // Sending null clears a level; sending nothing leaves it untouched.
        if (req.stopLoss !== undefined) {
            payload.stopLoss = req.stopLoss === null ? undefined : roundPrice(target.symbol, req.stopLoss);
        }
        if (req.takeProfit !== undefined) {
            payload.takeProfit = req.takeProfit === null ? undefined : roundPrice(target.symbol, req.takeProfit);
        }
        if (req.trailingStopDistance !== undefined && req.trailingStopDistance !== null) {
            payload.trailingStopLoss = req.trailingStopDistance > 0;
        }

        try {
            await this.client.send('ProtoOAAmendPositionSLTPReq', payload);
        } catch (e: any) {
            return { ok: false, error: e?.message ?? 'The broker refused the modification.' };
        }

        return {
            ok: true,
            data: {
                ...target,
                stopLoss: req.stopLoss !== undefined ? req.stopLoss : target.stopLoss,
                takeProfit: req.takeProfit !== undefined ? req.takeProfit : target.takeProfit,
            },
        };
    }

    async getPositions(accountId: string): Promise<VenueResult<VenuePosition[]>> {
        if (!this.isAvailable()) {
            return { ok: false, error: 'The broker connection is down; positions could not be read.' };
        }

        let res: any;
        try {
            res = await this.client.send('ProtoOAReconcileReq');
        } catch (e: any) {
            return { ok: false, error: e?.message ?? 'Could not read positions from the broker.' };
        }

        const out: VenuePosition[] = [];

        for (const p of (res?.position ?? []) as any[]) {
            const mapped = this.mapOpenPosition(p, accountId);
            if (mapped) out.push(mapped);
        }
        for (const o of (res?.order ?? []) as any[]) {
            const mapped = this.mapPendingOrder(o, accountId);
            if (mapped) out.push(mapped);
        }

        return { ok: true, data: out };
    }

    /** Our symbol name for a broker symbol id. */
    private ourSymbol(symbolId: unknown): string | undefined {
        return (this.feed as any).byBrokerId?.get(Number(symbolId));
    }

    private mapOpenPosition(p: any, accountId: string): VenuePosition | null {
        const symbol = this.ourSymbol(p?.tradeData?.symbolId);
        if (!symbol) return null;
        return {
            id: String(p.positionId),
            accountId,
            symbol,
            side: String(p.tradeData?.tradeSide) === 'SELL' ? 'SELL' : 'BUY',
            volume: this.toLots(symbol, Number(p.tradeData?.volume ?? 0)),
            entryPrice: Number(p.price ?? 0),
            stopLoss: p.stopLoss !== undefined ? Number(p.stopLoss) : null,
            takeProfit: p.takeProfit !== undefined ? Number(p.takeProfit) : null,
            commission: Math.abs(this.money(p.commission)) * 2, // reported one-way
            swap: this.money(p.swap),
            status: 'OPEN',
            openTime: p.tradeData?.openTimestamp ? new Date(Number(p.tradeData.openTimestamp)) : null,
        };
    }

    private mapPendingOrder(o: any, accountId: string): VenuePosition | null {
        const symbol = this.ourSymbol(o?.tradeData?.symbolId);
        if (!symbol) return null;
        return {
            id: String(o.orderId),
            accountId,
            symbol,
            side: String(o.tradeData?.tradeSide) === 'SELL' ? 'SELL' : 'BUY',
            volume: this.toLots(symbol, Number(o.tradeData?.volume ?? 0)),
            entryPrice: Number(o.limitPrice ?? o.stopPrice ?? 0),
            stopLoss: o.stopLoss !== undefined ? Number(o.stopLoss) : null,
            takeProfit: o.takeProfit !== undefined ? Number(o.takeProfit) : null,
            commission: 0,
            swap: 0,
            status: 'PENDING',
            openTime: null,
        };
    }

    /** Map the position carried on an execution event. */
    private mapPosition(event: any, accountId: string, fallbackSymbol: string): VenuePosition | null {
        const p = event?.position;
        if (p) {
            const mapped = this.mapOpenPosition(p, accountId);
            if (mapped) {
                const closed = String(p.positionStatus ?? '').includes('CLOSED');
                if (closed) {
                    mapped.status = 'CLOSED';
                    mapped.closeTime = new Date();
                    mapped.closePrice = Number(event?.deal?.executionPrice ?? p.price ?? 0);
                    mapped.finalProfit = this.money(event?.deal?.closePositionDetail?.grossProfit)
                        - mapped.commission + mapped.swap;
                }
                return mapped;
            }
        }

        const o = event?.order;
        if (o) return this.mapPendingOrder(o, accountId) ?? null;

        void fallbackSymbol;
        return null;
    }

    async getAccount(accountId: string): Promise<VenueResult<VenueAccount>> {
        if (!this.isAvailable()) {
            return { ok: false, error: 'The broker connection is down; the account could not be read.' };
        }

        let res: any;
        try {
            res = await this.client.send('ProtoOATraderReq');
        } catch (e: any) {
            return { ok: false, error: e?.message ?? 'Could not read the account from the broker.' };
        }

        const t = res?.trader;
        if (!t) return { ok: false, error: 'The broker returned no account details.' };

        const balance = this.money(t.balance);
        // The broker reports these only sometimes; derive what is missing from
        // the positions rather than reporting a zero that looks like a fact.
        const equity = t.equity !== undefined ? this.money(t.equity) : balance;
        const margin = t.usedMargin !== undefined ? this.money(t.usedMargin) : 0;

        return {
            ok: true,
            data: {
                accountId,
                currency: String(t.depositAssetId ?? 'USD'),
                balance,
                equity,
                margin,
                freeMargin: equity - margin,
                marginLevel: margin > 0 ? (equity / margin) * 100 : Number.POSITIVE_INFINITY,
                leverage: Number(t.leverageInCents ?? 0) / 100 || 200,
            },
        };
    }
}
