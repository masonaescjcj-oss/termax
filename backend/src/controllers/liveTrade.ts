/**
 * LIVE TRADING PATH — orders that go to the broker.
 *
 * Deliberately separate from tradeController's simulated path. The broker is
 * the book of record for a live account: we send the order, wait for the
 * broker's confirmation, and then write a local mirror row so history and the
 * UI keep working. Nothing here computes a balance, a margin level or a
 * stop-out — those come from the broker, because on a live account its view is
 * the only one that counts.
 *
 * If a write to our own database fails after the broker has filled, the
 * position still exists at the broker. Reconciliation on the next
 * getLivePositions() call repairs the mirror, so a local failure can never
 * make a real position disappear from the user's view.
 */

import { Response } from 'express';
import Position from '../models/Position';
import TradeHistory from '../models/TradeHistory';
import { AuthRequest } from '../middleware/auth';
import { getSpec, normaliseVolume } from '../config/instruments';
import { venueRouter } from '../services/venues';
import { AccountLike } from '../services/venues/router';
import { OrderKind, OrderSide, VenuePosition } from '../services/venues/types';
import { emitPositionUpdate } from '../sockets/tradeSocket';

/** Find the account record a request is aimed at. */
export function findAccount(user: any, accountId?: string): AccountLike | undefined {
    const accounts = user?.cTraderAccounts || [];
    if (accountId) return accounts.find((a: any) => a.cTraderId === accountId);
    return accounts.find((a: any) => a.accountType === 'DEMO') || accounts[0];
}

/**
 * Write (or update) the local mirror of a broker position.
 * Failures are logged and swallowed: the broker already acted, and losing the
 * mirror must not turn into a failed API response that makes the user retry an
 * order they have already placed.
 */
async function mirror(
    userId: string,
    account: AccountLike,
    p: VenuePosition
): Promise<any | null> {
    try {
        const existing = await Position.findOne({
            userId,
            accountId: p.accountId,
            brokerPositionId: p.id,
        });

        const fields = {
            userId,
            accountId: p.accountId,
            accountType: account.accountType || 'LIVE',
            symbol: p.symbol,
            side: p.side,
            volume: p.volume,
            entryPrice: p.entryPrice,
            stopLoss: p.stopLoss ?? null,
            takeProfit: p.takeProfit ?? null,
            commission: p.commission,
            swap: p.swap,
            status: p.status,
            orderType: p.status === 'PENDING' ? 'LIMIT' : 'MARKET',
            closePrice: p.closePrice ?? null,
            closeTime: p.closeTime ?? null,
            finalProfit: p.finalProfit ?? null,
            openTime: p.openTime ?? new Date(),
            venue: 'CTRADER' as const,
            brokerPositionId: p.id,
        };

        if (existing) {
            Object.assign(existing, fields);
            await existing.save();
            return existing;
        }

        const created = new Position(fields);
        await created.save();
        return created;
    } catch (e: any) {
        console.error(
            `[Live] Could not mirror broker position ${p.id} locally: ${e.message}. ` +
            'The position exists at the broker and will be picked up on the next reconcile.'
        );
        return null;
    }
}

/**
 * Resolve whatever id the client sent to the local mirror row. The client may
 * hold either our row id or the broker's reference, and a non-UUID value makes
 * the id lookup throw rather than return null, so each attempt is guarded.
 */
async function findMirrorRow(userId: string, positionId: string): Promise<any | null> {
    try {
        const byId = await Position.findOne({ userId, id: positionId });
        if (byId) return byId;
    } catch { /* not a row id — try the broker reference */ }

    try {
        return await Position.findOne({ userId, brokerPositionId: String(positionId) });
    } catch (e: any) {
        console.warn(`[Live] Could not resolve position ${positionId}: ${e.message}`);
        return null;
    }
}

/** Resolve the live venue, or send the caller a clear reason why not. */
function requireLiveVenue(account: AccountLike, res: Response) {
    const resolved = venueRouter.resolve(account);
    if ('error' in resolved) {
        res.status(503).json({ success: false, message: resolved.error });
        return null;
    }
    return resolved.venue;
}

// ═══════════════════════════════════════════════════════════════
//  OPEN
// ═══════════════════════════════════════════════════════════════

export async function openLiveOrder(
    req: AuthRequest,
    res: Response,
    user: any,
    account: AccountLike
): Promise<void> {
    const venue = requireLiveVenue(account, res);
    if (!venue) return;

    const { symbol, side, volume, takeProfit, stopLoss, orderType = 'MARKET', targetPrice, trailingStopDistance = 0 } = req.body;

    if (!symbol || !side) {
        res.status(400).json({ success: false, message: 'symbol and side are required.' });
        return;
    }

    const spec = getSpec(symbol);
    const requested = Number(volume);
    if (!(requested > 0)) {
        res.status(400).json({ success: false, message: 'Volume must be greater than zero.' });
        return;
    }
    if (requested < spec.minVolume) {
        res.status(400).json({ success: false, message: `Minimum volume for ${symbol} is ${spec.minVolume} lots.` });
        return;
    }
    if (requested > spec.maxVolume) {
        res.status(400).json({ success: false, message: `Maximum volume for ${symbol} is ${spec.maxVolume} lots.` });
        return;
    }

    const result = await venue.openOrder({
        accountId: account.cTraderId!,
        symbol,
        side: side as OrderSide,
        volume: normaliseVolume(symbol, requested),
        kind: String(orderType).toUpperCase() as OrderKind,
        targetPrice: targetPrice !== undefined ? Number(targetPrice) : undefined,
        stopLoss: stopLoss !== undefined && stopLoss !== null ? Number(stopLoss) : undefined,
        takeProfit: takeProfit !== undefined && takeProfit !== null ? Number(takeProfit) : undefined,
        trailingStopDistance: Number(trailingStopDistance) || 0,
    });

    if (!result.ok || !result.data) {
        res.status(400).json({ success: false, message: result.error ?? 'The broker did not accept the order.' });
        return;
    }

    const row = await mirror(req.user!.id, account, result.data);

    if (row) {
        try {
            await new TradeHistory({
                userId: req.user!.id,
                positionId: row._id ?? row.id,
                action: 'OPEN',
                details: `LIVE ${result.data.side} ${result.data.volume} lot(s) of ${result.data.symbol} at ${result.data.entryPrice} via ${account.broker ?? 'cTrader'} (broker ref ${result.data.id})`,
                priceAtAction: result.data.entryPrice,
            }).save();
        } catch (e: any) {
            console.warn('[Live] Trade history write failed:', e.message);
        }
    }

    const doc: any = row ? (row.toJSON ? row.toJSON() : row) : { ...result.data };
    doc.id = doc._id ?? doc.id ?? result.data.id;
    doc.venue = 'CTRADER';
    doc.brokerPositionId = result.data.id;

    res.status(200).json({ success: true, message: 'Order sent to the broker', data: doc });
    emitPositionUpdate(req.user!.id, 'positionOpened', { position: doc });
}

// ═══════════════════════════════════════════════════════════════
//  CLOSE
// ═══════════════════════════════════════════════════════════════

export async function closeLivePosition(
    req: AuthRequest,
    res: Response,
    user: any,
    account: AccountLike
): Promise<void> {
    const venue = requireLiveVenue(account, res);
    if (!venue) return;

    const { positionId, volume } = req.body;
    if (!positionId) {
        res.status(400).json({ success: false, message: 'positionId is required.' });
        return;
    }

    // The client holds our row id; the broker needs its own reference.
    const row = await findMirrorRow(req.user!.id, positionId);
    const brokerRef = row?.brokerPositionId ?? String(positionId);

    const result = await venue.closePosition({
        accountId: account.cTraderId!,
        positionId: brokerRef,
        volume: volume !== undefined ? Number(volume) : undefined,
    });

    if (!result.ok || !result.data) {
        res.status(400).json({ success: false, message: result.error ?? 'The broker did not close the position.' });
        return;
    }

    const updated = await mirror(req.user!.id, account, result.data);

    if (updated) {
        try {
            await new TradeHistory({
                userId: req.user!.id,
                positionId: updated._id ?? updated.id,
                action: 'CLOSE',
                details: `LIVE close of ${result.data.volume} lot(s) ${result.data.symbol} at ${result.data.closePrice ?? '-'} (broker ref ${result.data.id})`,
                priceAtAction: result.data.closePrice ?? result.data.entryPrice,
            }).save();
        } catch (e: any) {
            console.warn('[Live] Trade history write failed:', e.message);
        }
    }

    res.status(200).json({ success: true, message: 'Position closed at the broker', data: result.data });
    emitPositionUpdate(req.user!.id, 'positionClosed', {
        positionId: updated?._id ?? updated?.id ?? result.data.id,
        reason: 'MANUAL',
    });
}

// ═══════════════════════════════════════════════════════════════
//  MODIFY
// ═══════════════════════════════════════════════════════════════

export async function modifyLivePosition(
    req: AuthRequest,
    res: Response,
    user: any,
    account: AccountLike
): Promise<void> {
    const venue = requireLiveVenue(account, res);
    if (!venue) return;

    const { positionId, stopLoss, takeProfit, trailingStopDistance } = req.body;
    if (!positionId) {
        res.status(400).json({ success: false, message: 'positionId is required.' });
        return;
    }

    const row = await findMirrorRow(req.user!.id, positionId);
    const brokerRef = row?.brokerPositionId ?? String(positionId);

    const result = await venue.modifyPosition({
        accountId: account.cTraderId!,
        positionId: brokerRef,
        // undefined leaves a level alone; null clears it at the broker.
        stopLoss: stopLoss === undefined ? undefined : (stopLoss === null ? null : Number(stopLoss)),
        takeProfit: takeProfit === undefined ? undefined : (takeProfit === null ? null : Number(takeProfit)),
        trailingStopDistance: trailingStopDistance === undefined ? undefined : Number(trailingStopDistance),
    });

    if (!result.ok || !result.data) {
        res.status(400).json({ success: false, message: result.error ?? 'The broker refused the modification.' });
        return;
    }

    const updated = await mirror(req.user!.id, account, result.data);

    res.status(200).json({ success: true, message: 'Position modified at the broker', data: result.data });
    if (updated) {
        emitPositionUpdate(req.user!.id, 'positionModified', {
            position: updated.toJSON ? updated.toJSON() : updated,
        });
    }
}

// ═══════════════════════════════════════════════════════════════
//  READ / RECONCILE
// ═══════════════════════════════════════════════════════════════

/**
 * Positions as the broker reports them, with the local mirror brought into
 * line. Rows we hold that the broker no longer has are marked closed, so a
 * position closed from another terminal does not linger in the app.
 */
export async function getLivePositions(
    req: AuthRequest,
    res: Response,
    user: any,
    account: AccountLike
): Promise<void> {
    const venue = requireLiveVenue(account, res);
    if (!venue) return;

    const [positions, accountState] = await Promise.all([
        venue.getPositions(account.cTraderId!),
        venue.getAccount(account.cTraderId!),
    ]);

    if (!positions.ok || !positions.data) {
        res.status(503).json({ success: false, message: positions.error ?? 'Could not read positions from the broker.' });
        return;
    }

    const brokerRefs = new Set(positions.data.map(p => p.id));
    const mirrored = await Promise.all(
        positions.data.map(p => mirror(req.user!.id, account, p))
    );

    // Anything we still show as live that the broker no longer reports has been
    // closed elsewhere — reflect that rather than leaving a stale position.
    try {
        const local = await Position.find({
            userId: req.user!.id,
            accountId: account.cTraderId,
            status: 'OPEN',
        });
        for (const row of local as any[]) {
            if (row.venue !== 'CTRADER') continue;
            if (row.brokerPositionId && brokerRefs.has(row.brokerPositionId)) continue;
            row.status = 'CLOSED';
            row.closeTime = new Date();
            try {
                await row.save();
                console.log(`[Live] Marked ${row.brokerPositionId ?? row.id} closed — the broker no longer reports it.`);
            } catch (e: any) {
                console.warn('[Live] Could not close a stale mirror row:', e.message);
            }
        }
    } catch (e: any) {
        console.warn('[Live] Stale-position sweep failed:', e.message);
    }

    const formatted = positions.data.map((p, i) => {
        const row = mirrored[i];
        const spec = getSpec(p.symbol);
        return {
            ...p,
            // Keep the local id so the client can address it the usual way.
            id: row?._id ?? row?.id ?? p.id,
            brokerPositionId: p.id,
            venue: 'CTRADER',
            contractSize: spec.contractSize,
            digits: spec.digits,
            pipSize: spec.pipSize,
            quoteCurrency: spec.quote,
        };
    });

    res.status(200).json({
        success: true,
        data: {
            positions: formatted,
            // The broker's own numbers — never our own calculation on a live
            // account, because the broker's view is the one that settles.
            account: accountState.ok ? accountState.data : null,
            accountError: accountState.ok ? undefined : accountState.error,
            venue: 'CTRADER',
            accounts: (user?.cTraderAccounts || []).map((a: any) => {
                const doc = a.toJSON ? a.toJSON() : a;
                doc.id = doc.cTraderId || doc.accountId || doc._id;
                return doc;
            }),
        },
    });
}
