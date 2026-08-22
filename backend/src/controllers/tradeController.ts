import { Request, Response } from 'express';
import { getAuthUrl, getAccessToken, setToken, getToken } from '../services/ctraderService';
import { priceCache, fetchSinglePrice } from '../sockets/marketSocket';
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

        if (pos.side === 'BUY') {
            const newSL = currentPrice - pos.trailingStopDistance;
            if (!pos.stopLoss || newSL > pos.stopLoss) {
                pos.stopLoss = Math.round(newSL * 100000) / 100000;
                pos.trailingStopActivated = true;
                slChanged = true;
            }
        } else {
            const newSL = currentPrice + pos.trailingStopDistance;
            if (!pos.stopLoss || newSL < pos.stopLoss) {
                pos.stopLoss = Math.round(newSL * 100000) / 100000;
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

        let shouldClose = false;
        let reason = '';
        let closePrice = 0;

        // Check Take Profit
        if (pos.takeProfit) {
            if (pos.side === 'BUY' && currentPrice >= pos.takeProfit) {
                shouldClose = true;
                reason = 'TP';
                closePrice = pos.takeProfit;
            } else if (pos.side === 'SELL' && currentPrice <= pos.takeProfit) {
                shouldClose = true;
                reason = 'TP';
                closePrice = pos.takeProfit;
            }
        }

        // Check Stop Loss
        if (!shouldClose && pos.stopLoss) {
            if (pos.side === 'BUY' && currentPrice <= pos.stopLoss) {
                shouldClose = true;
                reason = 'SL';
                closePrice = pos.stopLoss;
            } else if (pos.side === 'SELL' && currentPrice >= pos.stopLoss) {
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

            const mult = pnlMultipliers[pos.symbol] || 1;
            const diff = pos.side === 'BUY' ? closePrice - pos.entryPrice : pos.entryPrice - closePrice;
            pos.finalProfit = (diff * pos.volume * mult) - (pos.commission || 0);

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
                const demoAccount = user.cTraderAccounts.find((a: any) => a.accountType === 'DEMO');
                if (demoAccount) {
                    demoAccount.balance = (demoAccount.balance ?? 0) + pos.finalProfit;
                    if (demoAccount.balance < 0) demoAccount.balance = 0;
                    await user.save();
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

export async function processPendingOrders(symbol: string, currentPrice: number, lowPrice?: number, highPrice?: number) {
    const posIds = symbolIndex.get(symbol);
    if (!posIds || posIds.size === 0) return;

    const toActivate: any[] = [];

    // Use candle low/high if provided, otherwise fall back to currentPrice
    const effectiveLow = lowPrice ?? currentPrice;
    const effectiveHigh = highPrice ?? currentPrice;

    for (const id of posIds) {
        if (activeOperations.has(id)) continue;

        const pos = positionMap.get(id);
        if (!pos || pos.status !== 'PENDING') continue;

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

            // Deduct commission from balance
            const user = await User.findById(pos.userId);
            if (user) {
                const demoAccount = user.cTraderAccounts.find((a: any) => a.accountType === 'DEMO');
                if (demoAccount) {
                    // Commission is already tracked on the position; no need to deduct from balance here
                    // (it's handled in PnL calculation via pos.commission)
                }
            }

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

// ── Real Broker Standard Settings ──
// Margin Call Level: 100% — warning shown, new orders blocked
const MARGIN_CALL_LEVEL = 100;
// Stop-Out Level: 50% — broker starts closing positions (IC Markets / Pepperstone standard)
const STOP_OUT_LEVEL = 50;

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
        // SAFETY: Verify user account exists and has valid balance from DB before stop-out
        const user = await User.findById(userId);
        if (!user) return;
        const demoAccount = user.cTraderAccounts.find((a: any) => a.accountType === 'DEMO');
        if (!demoAccount) return;
        
        // SAFETY: If DB balance is 0 or undefined, this account was never properly funded.
        // Do NOT trigger stop-out on an uninitialized account.
        const dbBalance = demoAccount.balance;
        if (dbBalance === undefined || dbBalance === null || dbBalance <= 0) {
            return;
        }

        const acctState = await getAccountState(userId);
        
        // SAFETY: Double-check that the balance used in margin calculation matches DB
        // This prevents stale cache from triggering false stop-outs
        if (Math.abs(acctState.balance - dbBalance) > 1) {
            console.log(`⚠️ [STOP-OUT SKIPPED] Balance mismatch for user ${userId}: acctState=${acctState.balance}, DB=${dbBalance}. Skipping.`);
            return;
        }
        
        // Stop Out if margin level is at or below STOP_OUT_LEVEL (50%)
        if (acctState.marginLevel <= STOP_OUT_LEVEL && acctState.margin > 0) {
            console.log(`🚨 [STOP-OUT] Triggered for user ${userId}. Balance: $${acctState.balance.toFixed(2)}, Equity: $${acctState.equity.toFixed(2)}, Margin Level: ${acctState.marginLevel.toFixed(2)}% (threshold: ${STOP_OUT_LEVEL}%)`);
            
            // Get all open positions for this user, sorted by PnL (close biggest losers first)
            const userPositions = await Position.find({ userId, status: 'OPEN' });
            
            // Sort by unrealized PnL ascending (worst losers first)
            userPositions.sort((a, b) => calcUnrealizedPnL(a) - calcUnrealizedPnL(b));
            
            for (const pos of userPositions) {
                const posId = pos._id.toString();
                if (activeOperations.has(posId)) continue;

                // Re-check margin level after each close — stop closing once above threshold
                const currentState = await getAccountState(userId);
                if (currentState.margin > 0 && currentState.marginLevel > STOP_OUT_LEVEL) {
                    console.log(`✅ [STOP-OUT] Margin level recovered to ${currentState.marginLevel.toFixed(2)}% for user ${userId}. Stopping liquidation.`);
                    break;
                }

                activeOperations.add(posId);

                try {
                    pos.status = 'CLOSED';
                    pos.closeTime = new Date();
                    pos.closePrice = priceCache[pos.symbol] || pos.entryPrice;
                    
                    const mult = pnlMultipliers[pos.symbol] || 1;
                    const diff = pos.side === 'BUY' ? pos.closePrice - pos.entryPrice : pos.entryPrice - pos.closePrice;
                    pos.finalProfit = (diff * pos.volume * mult) - (pos.commission || 0);
                    
                    await pos.save();
                    
                    const tradeHistory = new TradeHistory({
                        userId: userId,
                        positionId: pos._id,
                        action: 'CLOSE',
                        details: `STOP-OUT at ${pos.closePrice} with PnL: $${pos.finalProfit.toFixed(2)} (Margin Level ${acctState.marginLevel.toFixed(0)}% < ${STOP_OUT_LEVEL}%)`,
                        priceAtAction: pos.closePrice
                    });
                    await tradeHistory.save();
                    
                    // Update demo account balance with realized PnL
                    // Re-fetch user to avoid stale data
                    const freshUser = await User.findById(userId);
                    if (freshUser) {
                        const freshDemoAccount = freshUser.cTraderAccounts.find((a: any) => a.accountType === 'DEMO');
                        if (freshDemoAccount) {
                            freshDemoAccount.balance = (freshDemoAccount.balance ?? 0) + pos.finalProfit;
                            // Negative Balance Protection
                            if (freshDemoAccount.balance < 0) freshDemoAccount.balance = 0;
                            await freshUser.save();
                        }
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
//  FOREX CFD MARGIN ENGINE — Leverage 1:200
// ═══════════════════════════════════════════════════════════════

const LEVERAGE = 200;

const contractSizes: Record<string, number> = {
    'BTC/USDT': 1, 'ETH/USDT': 1, 'BNB/USDT': 1, 'SOL/USDT': 1,
    'XRP/USDT': 1, 'ADA/USDT': 1, 'DOGE/USDT': 1, 'AVAX/USDT': 1,
    'LINK/USDT': 1, 'DOT/USDT': 1, 'MATIC/USDT': 1, 'SHIB/USDT': 1,
    'LTC/USDT': 1, 'TRX/USDT': 1, 'UNI/USDT': 1,
    'GOLD': 100, 'SILVER': 5000, 'USOIL': 1000,
    'SPX': 1, 'NDQ': 1, 'DJI': 1, 'VIX': 1, 'DXY': 1,
    'AAPL': 1, 'MSFT': 1, 'NVDA': 1, 'GOOGL': 1, 'AMZN': 1, 'TSLA': 1, 'NFLX': 1,
};

const pnlMultipliers: Record<string, number> = {
    'BTC/USDT': 1, 'ETH/USDT': 1, 'BNB/USDT': 1, 'SOL/USDT': 1,
    'XRP/USDT': 1, 'ADA/USDT': 1, 'DOGE/USDT': 1, 'AVAX/USDT': 1,
    'LINK/USDT': 1, 'DOT/USDT': 1, 'MATIC/USDT': 1, 'SHIB/USDT': 1,
    'LTC/USDT': 1, 'TRX/USDT': 1, 'UNI/USDT': 1,
    'GOLD': 100, 'SILVER': 5000, 'USOIL': 1000,
    'SPX': 1, 'NDQ': 1, 'DJI': 1, 'VIX': 1, 'DXY': 1,
    'AAPL': 1, 'MSFT': 1, 'NVDA': 1, 'GOOGL': 1, 'AMZN': 1, 'TSLA': 1, 'NFLX': 1,
};

function calcMarginRequired(symbol: string, volume: number, price: number): number {
    const cs = contractSizes[symbol] || 1;
    return (volume * cs * price) / LEVERAGE;
}

function calcUnrealizedPnL(pos: any): number {
    const mult = pnlMultipliers[pos.symbol] || 1;
    const currentPrice = priceCache[pos.symbol] || pos.entryPrice;
    const diff = pos.side === 'BUY' ? (pos.closePrice || currentPrice) - pos.entryPrice : pos.entryPrice - (pos.closePrice || currentPrice);
    return (diff * pos.volume * mult) - (pos.commission || 0);
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
    if (!user) return { balance: 0, equity: 0, margin: 0, freeMargin: 0, marginLevel: 0, leverage: LEVERAGE, accountId: 'default_demo' };
    
    let targetAccount = accountId 
        ? user.cTraderAccounts.find((a: any) => a.cTraderId === accountId)
        : user.cTraderAccounts.find((a: any) => a.accountType === 'DEMO') || user.cTraderAccounts[0];

    if (!targetAccount && (accountId === 'default_demo' || !accountId)) {
        targetAccount = await ensureDefaultDemoAccount(user);
    }
    
    const balance = targetAccount?.balance ?? 0;
    const openPositions = await Position.find({ userId, status: 'OPEN', accountId: targetAccount?.cTraderId });
    let totalPnL = 0, totalMargin = 0;
    for (const pos of openPositions) {
        totalPnL += calcUnrealizedPnL(pos);
        totalMargin += calcMarginRequired(pos.symbol, pos.volume, pos.entryPrice);
    }
    const equity = balance + totalPnL;
    const freeMargin = equity - totalMargin;
    const marginLevel = totalMargin > 0 ? (equity / totalMargin) * 100 : 9999;
    return { balance, equity, margin: totalMargin, freeMargin, marginLevel, leverage: LEVERAGE, accountId: targetAccount?.cTraderId };
}

// ═══════════════════════════════════════════════════════════════
//  PIP VALUE TABLE — used by risk calculator
// ═══════════════════════════════════════════════════════════════

const pipValues: Record<string, { pipSize: number; pipValuePerLot: number }> = {
    'BTC/USDT':  { pipSize: 1,      pipValuePerLot: 1 },
    'ETH/USDT':  { pipSize: 1,      pipValuePerLot: 1 },
    'BNB/USDT':  { pipSize: 0.1,    pipValuePerLot: 0.1 },
    'SOL/USDT':  { pipSize: 0.01,   pipValuePerLot: 0.01 },
    'GOLD':      { pipSize: 0.01,   pipValuePerLot: 1 },
    'SILVER':    { pipSize: 0.001,  pipValuePerLot: 0.5 },
    'USOIL':     { pipSize: 0.01,   pipValuePerLot: 10 },
    'SPX':       { pipSize: 0.01,   pipValuePerLot: 1 },
    'NDQ':       { pipSize: 0.01,   pipValuePerLot: 1 },
    'AAPL':      { pipSize: 0.01,   pipValuePerLot: 0.01 },
    'TSLA':      { pipSize: 0.01,   pipValuePerLot: 0.01 },
};

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
        const pipInfo = pipValues[symbol] || { pipSize: 0.01, pipValuePerLot: 1 };
        const slPips = Number(stopLossDistance) / pipInfo.pipSize;
        const riskPerPipPerLot = pipInfo.pipValuePerLot;
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
            if (doc.status === 'OPEN') {
                doc.unrealizedPnL = calcUnrealizedPnL(p);
                doc.currentPrice = priceCache[p.symbol] || p.entryPrice;
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
            const serverPrice = priceCache[symbol];
            let rawPrice = serverPrice > 0 ? serverPrice : currentPrice;

            if (rawPrice <= 0 && isPending) rawPrice = Number(targetPrice);

            if (rawPrice <= 0) {
                return res.status(400).json({ success: false, message: 'Invalid entry price. Please wait for market data.' });
            }

            // SIMULATE BROKER SPREAD & SLIPPAGE (Raw/Zero Account style)
            let entryP = rawPrice;
            if (!isPending) {
                const spreadPercent = 0.00002; // 0.002% spread (e.g., ~$0.04 on Gold, ~$1.6 on BTC)
                const slippagePercent = Math.random() * 0.00002; // very tight slippage
                if (side === 'BUY') {
                    entryP = rawPrice * (1 + (spreadPercent / 2) + slippagePercent);
                } else {
                    entryP = rawPrice * (1 - (spreadPercent / 2) - slippagePercent);
                }
                // Round to sensible decimals (5 for forex/crypto standard)
                entryP = Number(entryP.toFixed(5));
            } else {
                entryP = Number(targetPrice);
            }

            // COMMISSION
            const COMMISSION_PER_LOT = 7; // $7 round turn
            const vol = Number(volume);
            const totalCommission = vol * COMMISSION_PER_LOT;

            // ═══ FOREX CFD MARGIN CHECK ═══
            if (vol < 0.01) return res.status(400).json({ success: false, message: 'Minimum volume is 0.01 lots.' });
            if (vol > 100) return res.status(400).json({ success: false, message: 'Maximum volume is 100 lots.' });

            const requiredMargin = calcMarginRequired(symbol, vol, entryP);
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
                const maxVol = Math.floor(((acct.freeMargin - COMMISSION_PER_LOT * 0.01) * LEVERAGE / ((contractSizes[symbol] || 1) * entryP)) * 100) / 100;
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
                initialSL = side === 'BUY' 
                    ? Math.round((entryP - trailingStopDistance) * 100000) / 100000
                    : Math.round((entryP + trailingStopDistance) * 100000) / 100000;
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
                details: `Opened ${side} ${vol} lot(s) of ${symbol} at ${entryP} | Margin: $${requiredMargin.toFixed(2)} | Leverage: 1:${LEVERAGE}`,
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

            // SIMULATE BROKER SPREAD & SLIPPAGE ON EXIT (Raw/Zero Account style)
            const spreadPercent = 0.00002;
            const slippagePercent = Math.random() * 0.00002;
            if (position.side === 'BUY') {
                // Closing a BUY is a SELL operation
                closeP = closeP * (1 - (spreadPercent / 2) - slippagePercent);
            } else {
                // Closing a SELL is a BUY operation
                closeP = closeP * (1 + (spreadPercent / 2) + slippagePercent);
            }
            closeP = Number(closeP.toFixed(5));

            const mult = pnlMultipliers[position.symbol] || 1;
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
                
                const diff = position.side === 'BUY' ? closeP - position.entryPrice : position.entryPrice - closeP;
                const finalProfit = (diff * closeVol * mult) - closedCommission;
                
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
                if (user) {
                    const demoAccount = user.cTraderAccounts.find((a: any) => a.accountType === 'DEMO');
                    if (demoAccount) {
                        demoAccount.balance = (demoAccount.balance ?? 0) + finalProfit;
                        await user.save();
                    }
                }
                
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
            
            const diff = position.side === 'BUY' ? closeP - position.entryPrice : position.entryPrice - closeP;
            position.finalProfit = (diff * position.volume * mult) - (position.commission || 0);
            
            await position.save();

            // Update demo account balance with realized PnL
            const user = await User.findById(req.user!.id);
            if (user) {
                const demoAccount = user.cTraderAccounts.find((a: any) => a.accountType === 'DEMO');
                if (demoAccount) {
                    demoAccount.balance = (demoAccount.balance ?? 0) + position.finalProfit;
                    await user.save();
                }
            }

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
