import { Request, Response } from 'express';
import { getAuthUrl, getAccessToken, setToken, getToken } from '../services/ctraderService';
import { priceCache, fetchSinglePrice } from '../sockets/marketSocket';
import {
    getSpec, roundPrice, normaliseVolume,
} from '../config/instruments';
import {
    marginRequired as calcMargin, pipValue, unrealizedPnL as calcFloatingPnL,
    realizedPnL, commissionFor, accountMetrics, openPrice as bookOpenPrice,
    closePrice as bookClosePrice, getMid, getQuote, nightlySwap, swapMultiplier,
    rateToAccount,
    MARGIN_CALL_LEVEL, STOP_OUT_LEVEL, Side,
} from '../services/pricing';
import Position from '../models/Position';
import TradeHistory from '../models/TradeHistory';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { emitPositionUpdate } from '../sockets/tradeSocket';

export const getAuth = (req: Request, res: Response) => {
    const url = getAuthUrl();
    res.status(200).json({ success: true, url });
};

export const authCallback = async (req: Request, res: Response) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).send('Authorization code missing.');
        }

        const tokenData = await getAccessToken(code as string);
        setToken(tokenData.accessToken);
        
        // MOCK: Fetching user profile from cTrader API
        const cTraderProfile = {
            cTraderId: 'ct_' + Math.random().toString(36).substr(2, 9),
            email: 'user@example.com',
            aliases: ['ProTrader_99']
        };

        // MOCK: Saving user to our MongoDB database
        console.log(`✅ [MongoDB] Saved/Updated user profile for cTrader ID: ${cTraderProfile.cTraderId}`);

        res.status(200).send(`
            <html>
            <head><style>body { font-family: sans-serif; background: #12161F; color: #FFF; text-align: center; padding: 50px; }</style></head>
            <body>
            <h2 style="color: #089981;">Successfully connected to cTrader!</h2>
            <p>Your profile has been saved to the database.</p>
            <p>You can now close this window and return to the app.</p>
            </body>
            </html>
        `);
    } catch (error: any) {
        res.status(500).send('Failed to authenticate with cTrader.');
    }
};

// ═══════════════════════════════════════════════════════════════
//  POSITIONS DATABASE + SYMBOL INDEX (O(1) trailing stop lookup)
// ═══════════════════════════════════════════════════════════════

const symbolIndex = new Map<string, Set<string>>();
const positionMap = new Map<string, any>();
const activeOperations = new Set<string>();

export const initTradingEngine = async () => {
    try {
        const openPos = await Position.find({ status: { $in: ['OPEN', 'PENDING'] } });
        symbolIndex.clear();
        positionMap.clear();
        
        for (const pos of openPos) {
            positionMap.set(pos._id.toString(), pos);
            if (!symbolIndex.has(pos.symbol)) symbolIndex.set(pos.symbol, new Set());
            symbolIndex.get(pos.symbol)!.add(pos._id.toString());
        }
        console.log(`✅ [Trading Engine] Initialized with ${openPos.length} active positions.`);
    } catch (err) {
        console.error('Failed to init trading engine:', err);
    }
};

function addToIndex(pos: any) {
    positionMap.set(pos._id.toString(), pos);
    if (!symbolIndex.has(pos.symbol)) symbolIndex.set(pos.symbol, new Set());
    symbolIndex.get(pos.symbol)!.add(pos._id.toString());
}

function removeFromIndex(posId: string, symbol: string) {
    positionMap.delete(posId);
    symbolIndex.get(symbol)?.delete(posId);
}

// ═══════════════════════════════════════════════════════════════
//  TRAILING STOP ENGINE — O(k) per symbol tick
// ═══════════════════════════════════════════════════════════════

export function processTrailingStops(symbol: string, currentPrice: number): string[] {
    const posIds = symbolIndex.get(symbol);
    if (!posIds || posIds.size === 0) return [];

    const modified: string[] = [];
    for (const id of posIds) {
        const pos = positionMap.get(id);
        if (!pos || pos.trailingStopDistance <= 0) continue;

        let slChanged = false;

        // Trail from the price the position would close at, and round to the
        // instrument's own precision — a flat 5 decimals mangles JPY pairs
        // (3 dp), indices (1 dp) and gold (2 dp).
        const exitSide = bookClosePrice(symbol, pos.side as Side) ?? currentPrice;

        if (pos.side === 'BUY') {
            const newSL = roundPrice(symbol, exitSide - pos.trailingStopDistance);
            if (!pos.stopLoss || newSL > pos.stopLoss) {
                pos.stopLoss = newSL;
                pos.trailingStopActivated = true;
                slChanged = true;
            }
        } else {
            const newSL = roundPrice(symbol, exitSide + pos.trailingStopDistance);
            if (!pos.stopLoss || newSL < pos.stopLoss) {
                pos.stopLoss = newSL;
                pos.trailingStopActivated = true;
                slChanged = true;
            }
        }

        if (slChanged) {
            modified.push(pos._id.toString());
            // Fire-and-forget DB update to avoid blocking tick processing
            Position.findByIdAndUpdate(pos._id, { 
                stopLoss: pos.stopLoss, 
                trailingStopActivated: true 
            }).catch(e => console.error('TS DB Update Error:', e));
        }
    }
    return modified;
}

// ═══════════════════════════════════════════════════════════════
//  TP/SL EXECUTION ENGINE — Real broker: execute on every tick
// ═══════════════════════════════════════════════════════════════

export async function processTPSL(symbol: string, currentPrice: number) {
    const posIds = symbolIndex.get(symbol);
    if (!posIds || posIds.size === 0) return;

    const toClose: { pos: any; reason: string; closePrice: number }[] = [];

    for (const id of posIds) {
        if (activeOperations.has(id)) continue;

        const pos = positionMap.get(id);
        if (!pos || pos.status !== 'OPEN') continue;

        // A stop or target is hit when the price the position would *close* at
        // reaches it: a long is measured against the bid, a short against the
        // ask. Testing both sides against one mid price (as before) fires a
        // long's stop late and a short's stop early, by the spread.
        const marketPrice = bookClosePrice(pos.symbol, pos.side as Side) ?? currentPrice;

        let shouldClose = false;
        let reason = '';
        let closePrice = 0;

        // Check Take Profit
        if (pos.takeProfit) {
            if (pos.side === 'BUY' && marketPrice >= pos.takeProfit) {
                shouldClose = true;
                reason = 'TP';
                closePrice = pos.takeProfit;
            } else if (pos.side === 'SELL' && marketPrice <= pos.takeProfit) {
                shouldClose = true;
                reason = 'TP';
                closePrice = pos.takeProfit;
            }
        }

        // Check Stop Loss
        if (!shouldClose && pos.stopLoss) {
            if (pos.side === 'BUY' && marketPrice <= pos.stopLoss) {
                shouldClose = true;
                reason = 'SL';
                closePrice = pos.stopLoss;
            } else if (pos.side === 'SELL' && marketPrice >= pos.stopLoss) {
                shouldClose = true;
                reason = 'SL';
                closePrice = pos.stopLoss;
            }
        }

        if (shouldClose) {
            activeOperations.add(id);
            toClose.push({ pos, reason, closePrice });
        }
    }

    for (const { pos, reason, closePrice } of toClose) {
        const posId = pos._id.toString();
        try {
            pos.status = 'CLOSED';
            pos.closeTime = new Date();
            pos.closePrice = closePrice;

            pos.finalProfit = realizedPnL(pos as any, closePrice) ?? 0;

            await pos.save();

            const tradeHistory = new TradeHistory({
                userId: pos.userId,
                positionId: pos._id,
                action: 'CLOSE',
                details: `${reason} hit at ${closePrice}. PnL: $${pos.finalProfit.toFixed(2)}`,
                priceAtAction: closePrice
            });
            await tradeHistory.save();

            // Update balance
            const user = await User.findById(pos.userId);
            if (user) {
                const credited = await creditRealisedPnL(user, pos, pos.finalProfit);
                if (!credited) {
                    console.error(`[${reason}] Could not credit P/L for position ${posId}: no matching account.`);
                }
            }

            removeFromIndex(posId, pos.symbol);
            console.log(`${reason === 'TP' ? '🟢' : '🔴'} [${reason}] ${pos.side} ${pos.volume} ${pos.symbol} closed at ${closePrice}. PnL: $${pos.finalProfit.toFixed(2)}`);
            emitPositionUpdate(pos.userId.toString(), 'positionClosed', { positionId: posId, reason });
        } catch (err) {
            pos.status = 'OPEN';
            console.error(`Error closing ${reason} for position ${posId}:`, err);
        } finally {
            activeOperations.delete(posId);
        }
    }
}

// ═══════════════════════════════════════════════════════════════
//  PENDING ORDER ACTIVATION ENGINE — activates limit/stop orders
// ═══════════════════════════════════════════════════════════════

export async function processPendingOrders(
    symbol: string,
    currentPrice: number,
    lowPrice?: number,
    highPrice?: number,
    barStart?: number
) {
    const posIds = symbolIndex.get(symbol);
    if (!posIds || posIds.size === 0) return;

    const toActivate: any[] = [];

    for (const id of posIds) {
        if (activeOperations.has(id)) continue;

        const pos = positionMap.get(id);
        if (!pos || pos.status !== 'PENDING') continue;

        // An intraday low/high may only trigger an order that already existed
        // when that bar opened. Without this check a BUY LIMIT placed below
        // the market activates instantly whenever the session low happens to
        // sit under it — a level the market may have touched hours before the
        // order was ever placed.
        const placedAt = new Date(pos.createdAt ?? pos.openTime ?? 0).getTime();
        const rangeIsValid = barStart !== undefined && placedAt <= barStart;
        const effectiveLow = rangeIsValid ? (lowPrice ?? currentPrice) : currentPrice;
        const effectiveHigh = rangeIsValid ? (highPrice ?? currentPrice) : currentPrice;

        let shouldActivate = false;

        if (pos.orderType === 'LIMIT') {
            // BUY LIMIT: candle low dropped to or below entry price
            if (pos.side === 'BUY' && effectiveLow <= pos.entryPrice) shouldActivate = true;
            // SELL LIMIT: candle high rose to or above entry price
            if (pos.side === 'SELL' && effectiveHigh >= pos.entryPrice) shouldActivate = true;
        } else if (pos.orderType === 'STOP') {
            // BUY STOP: candle high rose to or above entry price
            if (pos.side === 'BUY' && effectiveHigh >= pos.entryPrice) shouldActivate = true;
            // SELL STOP: candle low dropped to or below entry price
            if (pos.side === 'SELL' && effectiveLow <= pos.entryPrice) shouldActivate = true;
        }

        if (shouldActivate) {
            activeOperations.add(id);
            toActivate.push(pos);
        }
    }

    for (const pos of toActivate) {
        const posId = pos._id.toString();
        try {
            // Margin check before activation
            const acct = await getAccountState(pos.userId.toString());
            const requiredMargin = calcMarginRequired(pos.symbol, pos.volume, pos.entryPrice);
            const totalCost = requiredMargin + (pos.commission || 0);

            if (totalCost > acct.freeMargin) {
                // Not enough margin — cancel the pending order
                pos.status = 'CANCELLED';
                pos.closeTime = new Date();
                pos.finalProfit = 0;
                await pos.save();
                removeFromIndex(posId, pos.symbol);
                console.log(`❌ [PENDING CANCELLED] ${pos.side} ${pos.volume} ${pos.symbol} — Insufficient margin ($${acct.freeMargin.toFixed(2)} < $${totalCost.toFixed(2)})`);
                emitPositionUpdate(pos.userId.toString(), 'positionClosed', { positionId: posId, reason: 'MARGIN' });
                continue;
            }

            // Activate the pending order
            pos.status = 'OPEN';
            pos.openTime = new Date();
            await pos.save();

            // Commission is carried on the position and applied when P/L is
            // realised, so nothing is deducted from the balance at activation.

            // Update in-memory cache
            positionMap.set(posId, pos);

            const tradeHistory = new TradeHistory({
                userId: pos.userId,
                positionId: pos._id,
                action: 'OPEN',
                details: `Pending ${pos.orderType} activated: ${pos.side} ${pos.volume} lot(s) of ${pos.symbol} at ${pos.entryPrice}`,
                priceAtAction: currentPrice
            });
            await tradeHistory.save();

            console.log(`✅ [PENDING ACTIVATED] ${pos.side} ${pos.orderType} ${pos.volume} ${pos.symbol} at ${pos.entryPrice} (market: ${currentPrice})`);
            
            const doc: any = pos.toJSON ? pos.toJSON() : pos;
            doc.id = doc._id;
            emitPositionUpdate(pos.userId.toString(), 'positionOpened', { position: doc });
        } catch (err) {
            pos.status = 'PENDING';
            console.error(`Error activating pending order ${posId}:`, err);
        } finally {
            activeOperations.delete(posId);
        }
    }
}

// ═══════════════════════════════════════════════════════════════
//  STOP-OUT ENGINE — O(m) per symbol tick where m = users holding symbol
// ═══════════════════════════════════════════════════════════════

// Margin call (100%) and stop-out (50%) levels live in services/pricing.ts.

export async function processStopOuts(symbol: string, currentPrice: number) {
    const posIds = symbolIndex.get(symbol);
    if (!posIds || posIds.size === 0) return;

    // Find unique users holding this symbol
    const affectedUserIds = new Set<string>();
    for (const id of posIds) {
        const pos = positionMap.get(id);
        if (pos && pos.userId) {
            affectedUserIds.add(pos.userId.toString());
        }
    }

    for (const userId of affectedUserIds) {
        await processStopOutForUser(userId);
    }
}

async function processStopOutForUser(userId: string) {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        // Stop-out must be evaluated per account, not only on the demo one —
        // a LIVE account was previously never checked at all.
        const openPositions = await Position.find({ userId, status: 'OPEN' });
        if (!openPositions.length) return;

        const accountIds = Array.from(new Set(
            openPositions.map((p: any) => p.accountId).filter(Boolean)
        )) as string[];
        if (!accountIds.length) {
            const fallback = user.cTraderAccounts.find((a: any) => a.accountType === 'DEMO');
            if (fallback) accountIds.push(fallback.cTraderId);
        }

        for (const acctId of accountIds) {
            await processStopOutForAccount(userId, user, acctId);
        }
    } catch (err) {
        console.error(`Stop-out check failed for user ${userId}:`, err);
    }
}

async function processStopOutForAccount(userId: string, user: any, accountId: string) {
    try {
        const account = user.cTraderAccounts.find((a: any) => a.cTraderId === accountId);
        if (!account) return;

        // An account that was never funded has nothing to liquidate.
        const dbBalance = account.balance;
        if (dbBalance === undefined || dbBalance === null || dbBalance <= 0) return;

        const acctState = await getAccountState(userId, accountId);

        // A position we cannot value would make the margin level meaningless,
        // so never liquidate on a partial picture.
        if (acctState.unpriced && acctState.unpriced.length) {
            console.log(`⚠️ [STOP-OUT SKIPPED] ${accountId} holds unpriced symbols: ${acctState.unpriced.join(', ')}`);
            return;
        }
        
        // Stop Out if margin level is at or below STOP_OUT_LEVEL (50%)
        if (acctState.marginLevel <= STOP_OUT_LEVEL && acctState.margin > 0) {
            console.log(`🚨 [STOP-OUT] Triggered for user ${userId}. Balance: $${acctState.balance.toFixed(2)}, Equity: $${acctState.equity.toFixed(2)}, Margin Level: ${acctState.marginLevel.toFixed(2)}% (threshold: ${STOP_OUT_LEVEL}%)`);
            
            // Only this account's positions may be liquidated for its breach.
            const userPositions = await Position.find({ userId, status: 'OPEN', accountId });
            
            // Sort by unrealized PnL ascending (worst losers first)
            userPositions.sort((a, b) => calcUnrealizedPnL(a) - calcUnrealizedPnL(b));
            
            for (const pos of userPositions) {
                const posId = pos._id.toString();
                if (activeOperations.has(posId)) continue;

                // Re-check margin level after each close — stop closing once above threshold
                const currentState = await getAccountState(userId, accountId);
                if (currentState.margin > 0 && currentState.marginLevel > STOP_OUT_LEVEL) {
                    console.log(`✅ [STOP-OUT] Margin level recovered to ${currentState.marginLevel.toFixed(2)}% for user ${userId}. Stopping liquidation.`);
                    break;
                }

                activeOperations.add(posId);

                try {
                    pos.status = 'CLOSED';
                    pos.closeTime = new Date();
                    // Liquidate at the price the position would really close
                    // at: a long is sold into the bid, a short bought at the ask.
                    pos.closePrice = bookClosePrice(pos.symbol, pos.side as Side) ?? pos.entryPrice;
                    pos.finalProfit = realizedPnL(pos as any, pos.closePrice) ?? 0;
                    
                    await pos.save();
                    
                    const tradeHistory = new TradeHistory({
                        userId: userId,
                        positionId: pos._id,
                        action: 'CLOSE',
                        details: `STOP-OUT at ${pos.closePrice} with PnL: $${pos.finalProfit.toFixed(2)} (Margin Level ${acctState.marginLevel.toFixed(0)}% < ${STOP_OUT_LEVEL}%)`,
                        priceAtAction: pos.closePrice
                    });
                    await tradeHistory.save();
                    
                    // Re-fetch to avoid writing a stale balance, then credit
                    // the account the position actually belongs to.
                    const freshUser = await User.findById(userId);
                    if (freshUser) {
                        await creditRealisedPnL(freshUser, pos, pos.finalProfit);
                    }

                    removeFromIndex(posId, pos.symbol);
                    
                    console.log(`🔴 [STOP-OUT] Closed ${pos.side} ${pos.volume} ${pos.symbol} for user ${userId}. PnL: $${pos.finalProfit.toFixed(2)}`);
                    
                    // Emit to frontend
                    emitPositionUpdate(userId, 'stopOut', { positionId: posId });
                } catch (err) {
                    pos.status = 'OPEN';
                    console.error(`Error processing stop-out for position ${posId}:`, err);
                } finally {
                    activeOperations.delete(posId);
                }
            }
        }
    } catch (err) {
        console.error(`Error processing stop-out for user ${userId}:`, err);
    }
}

// Global stop-out check for ALL users with open positions (runs independently of subscriptions)
export async function runGlobalStopOutCheck() {
    try {
        const openPositions = await Position.find({ status: 'OPEN' });
        const userIds = new Set<string>();
        for (const pos of openPositions) {
            userIds.add(pos.userId.toString());
        }
        for (const userId of userIds) {
            await processStopOutForUser(userId);
        }
    } catch (err) {
        console.error('[Global Stop-Out] Error:', err);
    }
}

// ═══════════════════════════════════════════════════════════════
//  SWAP ACCRUAL — overnight financing
//
//  Brokers charge or pay financing on every position held through the daily
//  rollover, and book three days' worth on Wednesday to cover the weekend
//  value date. The `swap` column already existed in the schema but nothing
//  ever wrote to it, so holding a position was free.
// ═══════════════════════════════════════════════════════════════

/** Rollover hour in UTC — 21:00 UTC is the market-standard 17:00 New York. */
const ROLLOVER_HOUR_UTC = 21;

/** Guards against double-charging if the job runs twice in the same window. */
let lastRolloverKey: string | null = null;

const rolloverKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;

/**
 * Charge one night's financing to every open position.
 * Safe to call repeatedly — it only acts once per rollover date.
 */
export async function accrueOvernightSwap(now = new Date()): Promise<number> {
    if (now.getUTCHours() !== ROLLOVER_HOUR_UTC) return 0;

    const key = rolloverKey(now);
    if (lastRolloverKey === key) return 0;
    lastRolloverKey = key;

    let charged = 0;
    try {
        const open = await Position.find({ status: 'OPEN' });
        for (const pos of open as any[]) {
            const amount = nightlySwap(pos, now);
            if (amount === undefined) {
                console.warn(`[Swap] Skipped ${pos.symbol} — no rate available to value it.`);
                continue;
            }
            pos.swap = Number((((pos.swap as number) || 0) + amount).toFixed(2));
            try {
                await pos.save();
                charged++;
            } catch (e: any) {
                console.error(`[Swap] Failed to persist swap for ${pos._id}:`, e.message);
            }
        }
        if (charged) {
            console.log(`💤 [Swap] Applied ${swapMultiplier(now)}x overnight financing to ${charged} position(s).`);
        }
    } catch (e: any) {
        console.error('[Swap] Accrual run failed:', e.message);
    }
    return charged;
}

// ═══════════════════════════════════════════════════════════════
//  MARGIN / P&L — delegated to services/pricing.ts
//
//  The contract-size, P/L-multiplier and pip tables that used to live here
//  contained no forex pairs, so every forex lookup fell through to a default
//  of 1 and produced margins and P/L 100,000x too small. They are replaced by
//  config/instruments.ts (per-symbol contract specs) and services/pricing.ts
//  (bid/ask, currency conversion, margin, P/L, swap).
// ═══════════════════════════════════════════════════════════════

/** Margin for a position, in account currency. Throws if the symbol is unquoted. */
function calcMarginRequired(symbol: string, volume: number, _price?: number): number {
    const m = calcMargin(symbol, volume);
    if (m === undefined) {
        throw new Error(`Cannot price margin for ${symbol}: no quote available`);
    }
    return m;
}

/** Floating P/L of an open position; 0 when the symbol cannot be valued. */
function calcUnrealizedPnL(pos: any): number {
    return calcFloatingPnL(pos as any) ?? 0;
}

/**
 * Resolve the account a position belongs to.
 *
 * Every balance update used to look up `accountType === 'DEMO'` and ignore
 * `pos.accountId`, so a LIVE account's realised P/L was credited to the demo
 * account and a LIVE account was never stop-out checked at all.
 */
function accountForPosition(user: any, pos: any): any | undefined {
    const accounts = user?.cTraderAccounts || [];
    if (pos?.accountId) {
        const exact = accounts.find((a: any) => a.cTraderId === pos.accountId);
        if (exact) return exact;
        console.warn(`[Account] Position ${pos._id ?? pos.id} references unknown account ${pos.accountId}`);
        return undefined;
    }
    // Legacy rows carry no accountId; they predate multi-account support.
    return accounts.find((a: any) => a.accountType === 'DEMO') || accounts[0];
}

/** Apply realised P/L to the position's own account. */
async function creditRealisedPnL(user: any, pos: any, amount: number): Promise<boolean> {
    const account = accountForPosition(user, pos);
    if (!account) return false;
    account.balance = (account.balance ?? 0) + amount;
    if (account.balance < 0) account.balance = 0;
    user.markModified?.('cTraderAccounts');
    await user.save();
    return true;
}

async function ensureDefaultDemoAccount(userOrId: any): Promise<any> {
    const user = typeof userOrId === 'string' ? await User.findById(userOrId) : userOrId;
    if (!user) return null;
    
    let isModified = false;
    
    // Consolidate duplicate demo accounts
    const liveAccounts = user.cTraderAccounts.filter((a: any) => a.accountType !== 'DEMO');
    const demoAccounts = user.cTraderAccounts.filter((a: any) => a.accountType === 'DEMO');
    
    let demoAccount = demoAccounts.find((a: any) => a.cTraderId === 'default_demo');
    
    if (!demoAccount && demoAccounts.length > 0) {
        // Find first demo and update its ID to default_demo
        demoAccount = demoAccounts[0];
        demoAccount.cTraderId = 'default_demo';
        user.markModified('cTraderAccounts');
        isModified = true;
    }
    
    if (!demoAccount) {
        // Create new default_demo account
        user.cTraderAccounts.push({
            cTraderId: 'default_demo',
            accessToken: 'demo_token',
            accountType: 'DEMO',
            broker: 'TradeHub Internal',
            balance: 1000,
            currency: 'USD',
            leverage: '1:200',
            connectedAt: new Date()
        });
        user.markModified('cTraderAccounts');
        isModified = true;
        demoAccount = user.cTraderAccounts[user.cTraderAccounts.length - 1];
    }
    
    // If user has other demo accounts, migrate them and clean up list
    const otherDemoIds = demoAccounts
        .filter((a: any) => a.cTraderId !== 'default_demo')
        .map((a: any) => a.cTraderId);
        
    if (otherDemoIds.length > 0) {
        // Filter user accounts to exclude other demo accounts
        user.cTraderAccounts = [demoAccount, ...liveAccounts];
        user.markModified('cTraderAccounts');
        isModified = true;
        
        // Migrate all positions belonging to other demo accounts to default_demo
        try {
            const updateRes = await Position.updateMany(
                { userId: user._id, accountId: { $in: otherDemoIds } },
                { accountId: 'default_demo' }
            );
            console.log(`🔄 [Migration] Consolidated accounts. Migrated positions from other demo accounts (${otherDemoIds.join(', ')}) to default_demo for user ${user._id}. Positions updated: ${updateRes.modifiedCount}`);
        } catch (err) {
            console.error('Error migrating positions in account consolidation:', err);
        }
    }
    
    if (isModified) {
        await user.save();
    }
    return demoAccount;
}

async function getAccountState(userId: string, accountId?: string, userObj?: any) {
    const user = userObj || await User.findById(userId);
    if (!user) return { balance: 0, equity: 0, margin: 0, freeMargin: 0, marginLevel: 0, leverage: 200, accountId: 'default_demo', unpriced: [] as string[] };
    
    let targetAccount = accountId 
        ? user.cTraderAccounts.find((a: any) => a.cTraderId === accountId)
        : user.cTraderAccounts.find((a: any) => a.accountType === 'DEMO') || user.cTraderAccounts[0];

    if (!targetAccount && (accountId === 'default_demo' || !accountId)) {
        targetAccount = await ensureDefaultDemoAccount(user);
    }
    
    const balance = targetAccount?.balance ?? 0;
    const openPositions = await Position.find({ userId, status: 'OPEN', accountId: targetAccount?.cTraderId });
    const m = accountMetrics(balance, openPositions as any);
    if (m.unpriced.length) {
        console.warn(`[Account] Excluded unpriced positions for user ${userId}: ${m.unpriced.join(', ')}`);
    }
    return {
        balance: m.balance,
        equity: m.equity,
        margin: m.margin,
        freeMargin: m.freeMargin,
        // A flat account has no margin level to breach; keep the legacy
        // sentinel rather than Infinity so JSON responses stay numeric.
        marginLevel: Number.isFinite(m.marginLevel) ? m.marginLevel : 9999,
        leverage: Math.round(1 / getAverageMarginRate(openPositions as any)),
        accountId: targetAccount?.cTraderId,
        unpriced: m.unpriced,
    };
}

/** Effective leverage across held positions, for display on the account card. */
function getAverageMarginRate(positions: any[]): number {
    if (!positions.length) return getSpec('EUR/USD').marginRate;
    const total = positions.reduce((sum, p) => sum + getSpec(p.symbol).marginRate, 0);
    return total / positions.length;
}

// ═══════════════════════════════════════════════════════════════
//  PIP VALUE TABLE — used by risk calculator
// ═══════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════
//  RISK CALCULATOR
// ═══════════════════════════════════════════════════════════════

export const calculateLotSize = async (req: AuthRequest, res: Response) => {
    try {
        const { symbol, riskPercent, stopLossDistance } = req.body;
        if (!symbol || !riskPercent || !stopLossDistance) {
            return res.status(400).json({ success: false, message: 'symbol, riskPercent, and stopLossDistance are required' });
        }
        const acct = await getAccountState(req.user!.id);
        const equity = acct.equity;
        const requestedRiskAmount = equity * (Number(riskPercent) / 100);
        const spec = getSpec(symbol);
        const slPips = Number(stopLossDistance) / spec.pipSize;
        const riskPerPipPerLot = pipValue(symbol, 1);
        if (riskPerPipPerLot === undefined) {
            return res.status(400).json({ success: false, message: `No market data for ${symbol}; cannot size the position.` });
        }
        let idealLotSize = requestedRiskAmount / (slPips * riskPerPipPerLot);
        let marginWarning = false;
        let lotSize = idealLotSize;
        lotSize = Math.max(0.01, Math.min(lotSize, 1000));
        lotSize = Math.round(lotSize * 100) / 100;
        const actualRiskAmount = lotSize * slPips * riskPerPipPerLot;
        const actualRiskPercent = (actualRiskAmount / equity) * 100;
        const riskDeviation = Math.abs(actualRiskPercent - Number(riskPercent));
        const roundingWarning = riskDeviation > 0.1;
        let warningMsg = '';
        if (marginWarning) warningMsg = `⚠️ Volume reduced to ${lotSize} due to insufficient free margin.`;
        else if (roundingWarning) warningMsg = `⚠️ Min lot applied. Actual Risk: ${actualRiskPercent.toFixed(1)}% ($${actualRiskAmount.toFixed(0)}).`;
        else warningMsg = `Risk: $${actualRiskAmount.toFixed(2)} | Loss if SL hit: $${actualRiskAmount.toFixed(2)}`;
        res.status(200).json({
            success: true,
            data: { lotSize, riskAmount: Math.round(actualRiskAmount * 100) / 100, potentialLoss: Math.round(actualRiskAmount * 100) / 100, equity, slPips: Math.round(slPips * 100) / 100, warningMsg, isWarning: marginWarning || roundingWarning }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
//  CRUD ENDPOINTS (Protected)
// ═══════════════════════════════════════════════════════════════

export const getPositions = async (req: AuthRequest, res: Response) => {
    try {
        const { accountId } = req.query;
        
        // Ensure default demo account is initialized/migrated
        if (accountId === 'default_demo' || !accountId) {
            await ensureDefaultDemoAccount(req.user!.id);
        }

        const user = await User.findById(req.user!.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const query: any = { userId: req.user!.id };
        if (accountId) {
            query.accountId = accountId;
        }
        const positions = await Position.find(query).sort({ openTime: -1 });
        const acct = await getAccountState(req.user!.id, accountId as string);
        const formatted = positions.map(p => {
            const doc: any = p.toJSON();
            doc.id = doc._id.toString();

            // Ship the contract terms with every position so the client can
            // recompute P/L on each tick without keeping its own contract-size
            // and FX tables. Four copies of those tables had drifted across
            // the app, none of them containing any forex pair.
            const spec = getSpec(p.symbol);
            const q = getQuote(p.symbol);
            doc.contractSize = spec.contractSize;
            doc.digits = spec.digits;
            doc.pipSize = spec.pipSize;
            doc.quoteCurrency = spec.quote;
            // Rate from the instrument's quote currency into the account
            // currency; multiply a raw price move by this to get money.
            doc.quoteRate = rateToAccount(spec.quote) ?? null;
            doc.pipValue = pipValue(p.symbol, p.volume) ?? null;
            doc.marginUsed = calcMargin(p.symbol, p.volume) ?? null;

            if (doc.status === 'OPEN') {
                doc.unrealizedPnL = calcUnrealizedPnL(p);
                doc.currentPrice = getMid(p.symbol) ?? p.entryPrice;
                // The side the position would close at — what the P&L is
                // actually marked against.
                doc.marketPrice = bookClosePrice(p.symbol, p.side as Side) ?? p.entryPrice;
                doc.bid = q?.bid ?? null;
                doc.ask = q?.ask ?? null;
            }
            return doc;
        });

        const userAccounts = user.cTraderAccounts.map((a: any) => {
            const accDoc: any = a.toJSON ? a.toJSON() : a;
            accDoc.id = accDoc.cTraderId || accDoc.accountId || accDoc._id;
            return accDoc;
        });

        res.status(200).json({
            success: true,
            data: { 
                positions: formatted, 
                account: acct,
                accounts: userAccounts
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
//  PER-USER ORDER LOCK — Prevents race condition on margin check
// ═══════════════════════════════════════════════════════════════
const userOrderLocks = new Map<string, Promise<any>>();

async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    // Wait for any existing lock for this user
    const existing = userOrderLocks.get(userId);
    let release: () => void;
    const newLock = new Promise<void>(resolve => { release = resolve; });
    userOrderLocks.set(userId, newLock);
    
    if (existing) {
        await existing;
    }
    
    try {
        return await fn();
    } finally {
        release!();
        // Clean up if this is still the current lock
        if (userOrderLocks.get(userId) === newLock) {
            userOrderLocks.delete(userId);
        }
    }
}

export const executeOrder = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    
    await withUserLock(userId, async () => {
        try {
            const { symbol, side, volume, takeProfit, stopLoss, currentPrice, orderType = 'MARKET', targetPrice, trailingStopDistance = 0, accountId } = req.body;
            
            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ success: false, message: 'User not found' });

            // Ensure default demo account is initialized/migrated
            if (accountId === 'default_demo' || !accountId) {
                await ensureDefaultDemoAccount(user);
            }

            let targetAccount = accountId 
                ? user.cTraderAccounts.find(a => a.cTraderId === accountId)
                : user.cTraderAccounts.find(a => a.accountType === 'DEMO') || user.cTraderAccounts[0];

            // Auto-create demo account if none exists
            if (!targetAccount) {
                const newDemoId = 'default_demo';
                user.cTraderAccounts.push({
                    cTraderId: newDemoId,
                    accessToken: 'demo_token',
                    accountType: 'DEMO',
                    broker: 'TradeHub Internal',
                    balance: 1000,
                    currency: 'USD',
                    leverage: '1:200',
                    connectedAt: new Date()
                });
                await user.save();
                targetAccount = user.cTraderAccounts[user.cTraderAccounts.length - 1];
                console.log(`✅ Auto-created demo account for user ${user.username}: ${newDemoId}`);
            }

            const isPending = orderType !== 'MARKET';
            const spec = getSpec(symbol);

            // Fill on the correct side of the book: a market BUY pays the ask,
            // a market SELL receives the bid. The old code took a single mid
            // price and nudged it by 0.002% of price as a stand-in spread,
            // which is not how spreads work — that is 0.2 pip on EUR/USD but
            // $0.047 on gold — and it charged nothing on the exit leg.
            let entryP: number;
            if (isPending) {
                entryP = roundPrice(symbol, Number(targetPrice));
                if (!(entryP > 0)) {
                    return res.status(400).json({ success: false, message: 'A pending order needs a valid target price.' });
                }
            } else {
                const fill = bookOpenPrice(symbol, side as Side);
                if (fill === undefined || !(fill > 0)) {
                    return res.status(400).json({ success: false, message: 'No live quote for this symbol. Please wait for market data.' });
                }
                entryP = roundPrice(symbol, fill);
            }

            // ═══ VOLUME & COST ═══
            const requestedVol = Number(volume);
            if (!(requestedVol > 0)) {
                return res.status(400).json({ success: false, message: 'Volume must be greater than zero.' });
            }
            if (requestedVol < spec.minVolume) {
                return res.status(400).json({ success: false, message: `Minimum volume for ${symbol} is ${spec.minVolume} lots.` });
            }
            if (requestedVol > spec.maxVolume) {
                return res.status(400).json({ success: false, message: `Maximum volume for ${symbol} is ${spec.maxVolume} lots.` });
            }
            const vol = normaliseVolume(symbol, requestedVol);
            const totalCommission = commissionFor(symbol, vol);

            let requiredMargin: number;
            try {
                requiredMargin = calcMarginRequired(symbol, vol);
            } catch {
                return res.status(400).json({ success: false, message: `Cannot price margin for ${symbol} yet. Please wait for market data.` });
            }
            const acct = await getAccountState(userId, accountId, user);

            // Block if free margin is already negative or zero
            if (acct.freeMargin <= 0) {
                return res.status(400).json({
                    success: false,
                    message: `No free margin available. Free Margin: $${acct.freeMargin.toFixed(2)}. Close existing positions first.`
                });
            }

            // Check if free margin is enough for this order + commission
            const totalCost = requiredMargin + totalCommission;
            if (totalCost > acct.freeMargin) {
                // Largest volume the remaining free margin can carry.
                const marginForOneLot = calcMargin(symbol, 1) ?? Infinity;
                const commissionForOneLot = commissionFor(symbol, 1);
                const maxVol = normaliseVolume(symbol, Math.max(0,
                    acct.freeMargin / (marginForOneLot + commissionForOneLot)));
                return res.status(400).json({ 
                    success: false, 
                    message: `Insufficient margin. Required: $${totalCost.toFixed(2)} (margin $${requiredMargin.toFixed(2)} + commission $${totalCommission.toFixed(2)}), Available: $${acct.freeMargin.toFixed(2)}. Max volume: ${Math.max(0, maxVol)} lots.`
                });
            }

            // Prevent opening if margin level would drop below MARGIN_CALL_LEVEL (100%)
            const newTotalMargin = acct.margin + requiredMargin;
            const projectedEquity = acct.equity - totalCommission; // commission reduces equity
            const projectedMarginLevel = newTotalMargin > 0 ? (projectedEquity / newTotalMargin) * 100 : 9999;
            if (projectedMarginLevel < MARGIN_CALL_LEVEL) {
                return res.status(400).json({
                    success: false,
                    message: `Trade rejected: Margin level would drop to ${projectedMarginLevel.toFixed(0)}%. Minimum is ${MARGIN_CALL_LEVEL}%.`
                });
            }

            // Validate TP/SL side relative to execution price
            const checkPrice = entryP;
            if (side === 'BUY') {
                if (takeProfit && Number(takeProfit) <= checkPrice) {
                    return res.status(400).json({ success: false, message: `Take profit must be higher than execution price (${checkPrice}) for BUY orders.` });
                }
                if (stopLoss && Number(stopLoss) >= checkPrice) {
                    return res.status(400).json({ success: false, message: `Stop loss must be lower than execution price (${checkPrice}) for BUY orders.` });
                }
            } else if (side === 'SELL') {
                if (takeProfit && Number(takeProfit) >= checkPrice) {
                    return res.status(400).json({ success: false, message: `Take profit must be lower than execution price (${checkPrice}) for SELL orders.` });
                }
                if (stopLoss && Number(stopLoss) <= checkPrice) {
                    return res.status(400).json({ success: false, message: `Stop loss must be higher than execution price (${checkPrice}) for SELL orders.` });
                }
            }

            let initialSL = stopLoss;
            if (trailingStopDistance > 0 && !initialSL) {
                initialSL = roundPrice(symbol, side === 'BUY'
                    ? entryP - trailingStopDistance
                    : entryP + trailingStopDistance);
            }

            const position = new Position({
                userId: user._id,
                accountId: targetAccount.cTraderId,
                accountType: targetAccount.accountType,
                symbol,
                side,
                volume: vol,
                entryPrice: entryP,
                takeProfit,
                stopLoss: initialSL,
                trailingStopDistance: Number(trailingStopDistance),
                orderType,
                commission: totalCommission,
                status: isPending ? 'PENDING' : 'OPEN'
            });

            await position.save();

            const tradeHistory = new TradeHistory({
                userId: user._id,
                positionId: position._id,
                action: 'OPEN',
                details: `Opened ${side} ${vol} lot(s) of ${symbol} at ${entryP} | Margin: $${requiredMargin.toFixed(2)} | Leverage: 1:${Math.round(1 / getSpec(symbol).marginRate)}`,
                priceAtAction: entryP
            });
            await tradeHistory.save();

            addToIndex(position);

            const doc: any = position.toJSON();
            doc.id = doc._id;

            res.status(200).json({
                success: true,
                message: 'Order executed successfully',
                data: doc
            });

            // Emit real-time update to user's socket room
            const updatedAcct = await getAccountState(userId, accountId, user);
            emitPositionUpdate(userId, 'positionOpened', { position: doc, account: updatedAcct });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
};

export const closePosition = async (req: AuthRequest, res: Response) => {
    let positionId: string | undefined;
    try {
        const { positionId: reqPosId, currentPrice, volume } = req.body;
        positionId = reqPosId;
        if (!positionId) {
            return res.status(400).json({ success: false, message: 'Position ID is required' });
        }

        if (activeOperations.has(positionId)) {
            return res.status(409).json({ success: false, message: 'Position is currently processing a state change. Please try again.' });
        }
        activeOperations.add(positionId);

        try {
            const position = await Position.findOne({ _id: positionId, userId: req.user!.id });
            if (!position || position.status === 'CLOSED' || position.status === 'CANCELLED') {
                return res.status(404).json({ success: false, message: 'Position not found or already closed/cancelled' });
            }

            if (position.status === 'PENDING') {
                position.status = 'CANCELLED';
                position.closeTime = new Date();
                position.finalProfit = 0;
                await position.save();

                const tradeHistory = new TradeHistory({
                    userId: req.user!.id,
                    positionId: position._id,
                    action: 'CLOSE',
                    details: `Order cancelled by user`,
                    priceAtAction: position.entryPrice
                });
                await tradeHistory.save();

                removeFromIndex(position._id.toString(), position.symbol);

                const doc = position.toJSON();
                doc.id = doc._id;

                res.status(200).json({
                    success: true,
                    message: 'Order cancelled successfully',
                    data: doc
                });

                const updatedAcct = await getAccountState(req.user!.id);
                emitPositionUpdate(req.user!.id, 'positionClosed', { position: doc, account: updatedAcct });
                return;
            }

            const serverPrice = priceCache[position.symbol];
            let closeP = serverPrice > 0 ? serverPrice : currentPrice;

            if (!closeP || closeP <= 0) {
                const fetchedPrice = await fetchSinglePrice(position.symbol);
                if (fetchedPrice && fetchedPrice > 0) {
                    closeP = fetchedPrice;
                    priceCache[position.symbol] = fetchedPrice;
                }
            }

            if (!closeP || closeP <= 0) {
                return res.status(400).json({ success: false, message: 'Market data not available to close position. Please try again.' });
            }

            // Close on the real side of the book: a long is sold into the bid,
            // a short is bought back at the ask. The spread is therefore
            // charged on the exit leg too — the old code applied a flat
            // 0.002% of price as a stand-in, which is not how spreads work
            // (it priced EUR/USD at 0.2 pip but GOLD at $0.047) and only ever
            // charged half a spread per round trip.
            const bookExit = bookClosePrice(position.symbol, position.side as Side);
            closeP = roundPrice(position.symbol, bookExit ?? closeP);

            const closeVol = volume ? Number(volume) : position.volume;
            
            if (closeVol <= 0 || closeVol > position.volume) {
                return res.status(400).json({ success: false, message: 'Invalid close volume' });
            }

            const isPartial = closeVol < position.volume;

            if (isPartial) {
                const ratio = closeVol / position.volume;
                const closedCommission = Math.round((position.commission || 0) * ratio * 100) / 100;
                
                // Adjust original position
                position.volume = Math.round((position.volume - closeVol) * 100) / 100;
                position.commission = Math.round(((position.commission || 0) - closedCommission) * 100) / 100;
                
                const finalProfit = realizedPnL(
                    { ...position, volume: closeVol, commission: closedCommission } as any,
                    closeP
                ) ?? 0;
                
                await position.save();
                
                // Update memory map for original position
                positionMap.set(position._id.toString(), position);
                
                // Create a new CLOSED position representing the closed portion
                const closedPart = new Position({
                    userId: position.userId,
                    accountId: position.accountId,
                    accountType: position.accountType,
                    symbol: position.symbol,
                    side: position.side,
                    volume: closeVol,
                    entryPrice: position.entryPrice,
                    closePrice: closeP,
                    takeProfit: position.takeProfit,
                    stopLoss: position.stopLoss,
                    commission: closedCommission,
                    status: 'CLOSED',
                    openTime: position.openTime,
                    closeTime: new Date(),
                    finalProfit: finalProfit
                });
                await closedPart.save();
                
                // Save to TradeHistory for partial close
                const tradeHistory = new TradeHistory({
                    userId: req.user!.id,
                    positionId: closedPart._id,
                    action: 'CLOSE',
                    details: `Partially closed ${closeVol} lots at ${closeP} with PnL: $${finalProfit.toFixed(2)} (Remaining: ${position.volume} lots)`,
                    priceAtAction: closeP
                });
                await tradeHistory.save();
                
                // Update demo account balance
                const user = await User.findById(req.user!.id);
                if (user) await creditRealisedPnL(user, position, finalProfit);
                
                const doc = closedPart.toJSON();
                doc.id = doc._id;
                
                res.status(200).json({
                    success: true,
                    message: 'Position partially closed',
                    data: doc
                });
                
                // Emit real-time update
                const updatedAcct = await getAccountState(req.user!.id, undefined, user);
                emitPositionUpdate(req.user!.id, 'positionClosed', { position: doc, account: updatedAcct });
                // Emit updated remaining position
                const remainingDoc: any = position.toJSON();
                remainingDoc.id = remainingDoc._id;
                remainingDoc.unrealizedPnL = calcUnrealizedPnL(position);
                remainingDoc.currentPrice = priceCache[position.symbol] || position.entryPrice;
                emitPositionUpdate(req.user!.id, 'positionOpened', { position: remainingDoc, account: updatedAcct });
                return;
            }

            // Full close logic
            position.status = 'CLOSED';
            position.closeTime = new Date();
            position.closePrice = closeP;
            
            position.finalProfit = realizedPnL(position as any, closeP) ?? 0;
            
            await position.save();

            // Credit realised P/L to the account the position belongs to.
            const user = await User.findById(req.user!.id);
            if (user) await creditRealisedPnL(user, position, position.finalProfit);

            const tradeHistory = new TradeHistory({
                userId: req.user!.id,
                positionId: position._id,
                action: 'CLOSE',
                details: `Closed at ${closeP} with PnL: $${position.finalProfit.toFixed(2)}`,
                priceAtAction: position.closePrice
            });
            await tradeHistory.save();

            removeFromIndex(position._id.toString(), position.symbol);
            
            const doc = position.toJSON();
            doc.id = doc._id;

            res.status(200).json({
                success: true,
                message: 'Position closed',
                data: doc
            });

            // Emit real-time update to user's socket room
            const updatedAcct = await getAccountState(req.user!.id, undefined, user);
            emitPositionUpdate(req.user!.id, 'positionClosed', { position: doc, account: updatedAcct });
        } finally {
            activeOperations.delete(positionId);
        }
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const modifyPosition = async (req: AuthRequest, res: Response) => {
    let positionId: string | undefined;
    try {
        const { positionId: reqPosId, takeProfit, stopLoss, trailingStopDistance } = req.body;
        positionId = reqPosId;
        if (!positionId) {
            return res.status(400).json({ success: false, message: 'Position ID is required' });
        }

        if (activeOperations.has(positionId)) {
            return res.status(409).json({ success: false, message: 'Position is currently processing a state change. Please try again.' });
        }
        activeOperations.add(positionId);

        try {
            const position = await Position.findOne({ _id: positionId, userId: req.user!.id });
            if (!position) {
                return res.status(404).json({ success: false, message: 'Position not found' });
            }

            const currentPrice = priceCache[position.symbol] || position.entryPrice;
            if (position.side === 'BUY') {
                if (takeProfit && Number(takeProfit) <= currentPrice) {
                    return res.status(400).json({ success: false, message: `Take profit must be higher than current price (${currentPrice}) for BUY positions.` });
                }
                if (stopLoss && Number(stopLoss) >= currentPrice) {
                    return res.status(400).json({ success: false, message: `Stop loss must be lower than current price (${currentPrice}) for BUY positions.` });
                }
            } else if (position.side === 'SELL') {
                if (takeProfit && Number(takeProfit) >= currentPrice) {
                    return res.status(400).json({ success: false, message: `Take profit must be lower than current price (${currentPrice}) for SELL positions.` });
                }
                if (stopLoss && Number(stopLoss) <= currentPrice) {
                    return res.status(400).json({ success: false, message: `Stop loss must be higher than current price (${currentPrice}) for SELL positions.` });
                }
            }

            if (takeProfit !== undefined) position.takeProfit = takeProfit;
            if (stopLoss !== undefined) position.stopLoss = stopLoss;
            if (trailingStopDistance !== undefined) {
                position.trailingStopDistance = Number(trailingStopDistance);
                if (trailingStopDistance <= 0) position.trailingStopActivated = false;
            }
            
            await position.save();
            
            // Update memory map too
            positionMap.set(position._id.toString(), position);

            const tradeHistory = new TradeHistory({
                userId: req.user!.id,
                positionId: position._id,
                action: 'MODIFY',
                details: `Modified TP=${takeProfit}, SL=${stopLoss}, TS=${trailingStopDistance}`,
                priceAtAction: position.entryPrice // Just placeholder
            });
            await tradeHistory.save();

            const doc = position.toJSON();
            doc.id = doc._id;

            // Emit real-time update to user's socket room so all screens (chart, positions) sync instantly
            const updatedAcct = await getAccountState(req.user!.id);
            emitPositionUpdate(req.user!.id, 'positionOpened', { position: doc, account: updatedAcct });

            res.status(200).json({
                success: true,
                message: 'Position modified',
                data: doc
            });
        } finally {
            activeOperations.delete(positionId);
        }
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const addAdvancedRule = async (req: AuthRequest, res: Response) => {
    let positionId: string | undefined;
    try {
        const { positionId: reqPosId, ruleType, triggerPips, actionValue } = req.body;
        positionId = reqPosId;
        if (!positionId) {
            return res.status(400).json({ success: false, message: 'Position ID is required' });
        }

        if (activeOperations.has(positionId)) {
            return res.status(409).json({ success: false, message: 'Position is currently processing a state change. Please try again.' });
        }
        activeOperations.add(positionId);

        try {
            const position = await Position.findOne({ _id: positionId, userId: req.user!.id });
            if (!position) return res.status(404).json({ success: false, message: 'Position not found' });

            position.advancedRules.push({
                ruleType,
                triggerPips: Number(triggerPips),
                actionValue: Number(actionValue),
                status: 'ACTIVE'
            });

            await position.save();

            res.status(200).json({
                success: true,
                message: 'Advanced rule activated',
                data: position.advancedRules[position.advancedRules.length - 1]
            });
        } finally {
            activeOperations.delete(positionId);
        }
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
