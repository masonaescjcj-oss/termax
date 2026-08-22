/**
 * BOT RUNNER — executes strategy specs against the live feed, on paper.
 *
 * The runner owns the map from closed bars to bot decisions, and hands every
 * resulting order to the SAME simulated-order core the HTTP API uses
 * (openSimulatedOrder / closeSimulatedAtMarket in tradeController). One code
 * path, two callers: a bot's fill can never diverge from a human's.
 *
 * Scale shape (docs/ai-architecture.md §2): bots are indexed by symbol, so a
 * bar close touches only the bots on that symbol; indicators live inside each
 * compiled strategy today and move to the shared bus when profiling says so —
 * the interpreter contract already isolates that change.
 *
 * Fairness: orders are executed through per-account promise chains, so one
 * user's twenty bots queue behind each other instead of starving everyone
 * else, and two signals on one account can never interleave their margin
 * checks.
 */

import Bot, { BotRow } from '../../models/Bot';
import Position from '../../models/Position';
import {
    closeSimulatedAtMarket, openSimulatedOrder,
} from '../../controllers/tradeController';
import { closeLivePositionCore, openLiveOrderCore } from '../../controllers/liveTrade';
import { getSpec, normaliseVolume } from '../../config/instruments';
import { getSpreadPips, pipValue, accountMetrics, openPrice } from '../pricing';
import User from '../../models/User';
import { compileStrategy, CompiledStrategy } from '../strategy/interpreter';
import { Bar, BotState, EntryDecision, Timeframe } from '../strategy/types';

interface RunningBot {
    row: BotRow;
    compiled: CompiledStrategy;
    state: BotState;
    /** Local id of this bot's open simulated position, if any. */
    openPositionId: string | null;
    openSide: 'BUY' | 'SELL' | null;
    /** Serialises this bot's own async work so bars cannot interleave. */
    busy: Promise<void>;
}

export class BotRunner {
    private bots = new Map<string, RunningBot>();
    /** symbol -> bot ids listening to it (any of their timeframes). */
    private bySymbol = new Map<string, Set<string>>();
    /** Per-account execution chains — the fairness/serialisation queues. */
    private accountQueues = new Map<string, Promise<void>>();
    /** Called when a bot subscribes a symbol the feed isn't streaming yet. */
    private ensureFeed: (symbol: string) => void = () => {};

    /**
     * Wire the feed hook (server boot does this before loadActive). Replays
     * every already-registered symbol so nothing registered earlier is left
     * unstreamed.
     */
    setFeedHook(fn: (symbol: string) => void): void {
        this.ensureFeed = fn;
        for (const symbol of this.bySymbol.keys()) fn(symbol);
    }

    size(): number {
        return this.bots.size;
    }

    /** Load every FORWARD_TEST bot from the database — boot path. */
    async loadActive(): Promise<number> {
        let rows: BotRow[] = [];
        try {
            rows = await Bot.listActive();
        } catch (e: any) {
            console.error('[Bots] Could not load active bots:', e.message);
            return 0;
        }
        let ok = 0;
        for (const row of rows) {
            try {
                await this.register(row);
                ok++;
            } catch (e: any) {
                console.error(`[Bots] Skipping bot ${row.id} ("${row.name}"): ${e.message}`);
            }
        }
        if (ok) console.log(`🤖 [Bots] ${ok} bot(s) running in forward test.`);
        return ok;
    }

    /** Start running a bot. Throws when its spec no longer compiles. */
    async register(row: BotRow): Promise<void> {
        if (this.bots.has(row.id)) return;

        const compiled = compileStrategy(row.spec);

        // Reattach to a position this bot already holds (restart resume).
        let openPositionId: string | null = null;
        let openSide: 'BUY' | 'SELL' | null = null;
        try {
            const held = await Position.find({ userId: row.userId, status: 'OPEN' });
            const mine = (held as any[]).find(p => p.botId === row.id);
            if (mine) {
                openPositionId = String(mine.id ?? mine._id);
                openSide = mine.side;
            }
        } catch (e: any) {
            console.warn(`[Bots] Could not check open positions for ${row.id}: ${e.message}`);
        }

        this.bots.set(row.id, {
            row, compiled, state: row.runState,
            openPositionId, openSide,
            busy: Promise.resolve(),
        });

        const symbol = row.spec.symbol;
        if (!this.bySymbol.has(symbol)) this.bySymbol.set(symbol, new Set());
        this.bySymbol.get(symbol)!.add(row.id);
        this.ensureFeed(symbol);
    }

    unregister(botId: string): void {
        const bot = this.bots.get(botId);
        if (!bot) return;
        this.bots.delete(botId);
        this.bySymbol.get(bot.row.spec.symbol)?.delete(botId);
    }

    /**
     * A closed bar arrived. Touches only the bots on this symbol; each bot's
     * evaluation and execution are chained on its own promise so a slow order
     * cannot make the next bar's evaluation overlap this one.
     */
    onBar(symbol: string, tf: Timeframe, bar: Bar): void {
        const ids = this.bySymbol.get(symbol);
        if (!ids || ids.size === 0) return;

        for (const id of ids) {
            const bot = this.bots.get(id);
            if (!bot) continue;
            if (!bot.compiled.timeframes.includes(tf)) continue;

            bot.busy = bot.busy
                .then(() => this.step(bot, tf, bar))
                .catch(e => console.error(`[Bots] ${bot.row.name}: ${e.message}`));
        }
    }

    private async step(bot: RunningBot, tf: Timeframe, bar: Bar): Promise<void> {
        const position = bot.openSide ? { side: bot.openSide } : null;
        const { decision, state } = bot.compiled.onBar(tf, bar, bot.state, {
            position,
            spreadPips: getSpreadPips(bot.row.spec.symbol),
        });
        bot.state = state;

        const live = bot.row.status === 'LIVE';

        if (decision.exit && bot.openPositionId) {
            const posId = bot.openPositionId;
            await this.onAccount(bot.row.accountId, async () => {
                let r: { status: number; body: any };
                if (live) {
                    const account = await this.resolveAccount(bot);
                    if (!account) return; // transient; refresh will reconcile
                    r = await closeLivePositionCore(bot.row.userId, account, posId, `BOT ${decision.exit!.reason}`);
                } else {
                    r = await closeSimulatedAtMarket(bot.row.userId, posId, `BOT ${decision.exit!.reason}`);
                }
                if (r.status === 200 || r.status === 404) {
                    // 404 = already closed by SL/TP/stop-out; either way we are flat.
                    bot.openPositionId = null;
                    bot.openSide = null;
                } else {
                    console.error(`[Bots] ${bot.row.name}: close failed — ${r.body?.message ?? r.status}`);
                }
            });
        } else if (decision.enter && !bot.openPositionId) {
            const enter = decision.enter;
            const volume = await this.sizeOrder(bot, enter);
            if (volume === null) return;

            await this.onAccount(bot.row.accountId, async () => {
                let r: { status: number; body: any };
                const orderParams = {
                    symbol: bot.row.spec.symbol,
                    side: enter.side,
                    volume,
                    stopLoss: enter.stopLossPrice,
                    takeProfit: enter.takeProfitPrice,
                    trailingStopDistance: enter.trailingDistance ?? 0,
                    orderType: 'MARKET' as const,
                    botId: bot.row.id,
                };
                if (live) {
                    const account = await this.resolveAccount(bot);
                    if (!account) {
                        console.error(`[Bots] ${bot.row.name}: live account ${bot.row.accountId} not found; entry skipped.`);
                        return;
                    }
                    r = await openLiveOrderCore(bot.row.userId, account, orderParams);
                } else {
                    r = await openSimulatedOrder(bot.row.userId, { accountId: bot.row.accountId, ...orderParams });
                }
                if (r.status === 200) {
                    bot.openPositionId = String(r.body?.data?.id ?? r.body?.data?._id ?? '');
                    bot.openSide = enter.side;
                } else {
                    // A refused entry (margin, quotes, broker reject) is
                    // information, not a crash.
                    console.warn(`[Bots] ${bot.row.name}: entry refused — ${r.body?.message ?? r.status}`);
                }
            });
        } else if (bot.openPositionId) {
            // The engine may have closed us via SL/TP/stop-out between bars.
            await this.refreshPositionState(bot);
        }

        // Persist counters occasionally — cheap (one small update) and it
        // keeps daily limits honest across restarts.
        try {
            await Bot.saveRunState(bot.row.id, bot.state);
        } catch { /* non-fatal; retried next bar */ }
    }

    /** The user's account record backing this bot. */
    private async resolveAccount(bot: RunningBot): Promise<any | null> {
        try {
            const user = await User.findById(bot.row.userId);
            return user?.cTraderAccounts?.find((a: any) => a.cTraderId === bot.row.accountId) ?? null;
        } catch {
            return null;
        }
    }

    /** Convert a decision's sizing into lots, or refuse with a reason. */
    private async sizeOrder(bot: RunningBot, enter: EntryDecision): Promise<number | null> {
        const symbol = bot.row.spec.symbol;
        const spec = getSpec(symbol);

        // Live default: the instrument's minimum, whatever the spec says.
        // Real money starts at the smallest possible size; trusting the
        // spec's own sizing is an explicit opt-in made at go-live.
        if (bot.row.status === 'LIVE' && bot.row.liveVolumeMode === 'MIN') {
            return spec.minVolume;
        }

        if ('fixedLots' in enter.sizing) return enter.sizing.fixedLots;

        // riskPercent: lots such that (SL distance) x pipValue = equity x pct.
        const perLotPip = pipValue(symbol, 1);
        if (perLotPip === undefined) {
            console.warn(`[Bots] ${bot.row.name}: no pip value for ${symbol}; entry skipped.`);
            return null;
        }

        let equity = 0;
        try {
            const user = await User.findById(bot.row.userId);
            const account = user?.cTraderAccounts?.find((a: any) => a.cTraderId === bot.row.accountId);
            const open = await Position.find({ userId: bot.row.userId, status: 'OPEN', accountId: bot.row.accountId });
            const live = bot.row.status === 'LIVE';
            const relevant = (open as any[]).filter(p => live ? p.venue === 'CTRADER' : p.venue !== 'CTRADER');
            equity = accountMetrics(account?.balance ?? 0, relevant as any).equity;
        } catch (e: any) {
            console.warn(`[Bots] ${bot.row.name}: could not read equity (${e.message}); entry skipped.`);
            return null;
        }
        if (!(equity > 0)) return null;

        // SL distance in pips from the price this order would actually fill
        // at right now — the decision carries the SL price, and the fill side
        // is the ask for a buy, the bid for a sell.
        const fill = openPrice(symbol, enter.side);
        if (fill === undefined) return null;
        const distPips = Math.abs(fill - enter.stopLossPrice) / spec.pipSize;
        if (!(distPips > 0)) return null;

        const riskMoneyTarget = equity * (enter.sizing.riskPercent / 100);
        const lots = riskMoneyTarget / (distPips * perLotPip);
        const sized = normaliseVolume(symbol, lots);
        return sized >= spec.minVolume ? sized : null;
    }

    /** Re-check whether the engine closed this bot's position between bars. */
    private async refreshPositionState(bot: RunningBot): Promise<void> {
        try {
            const pos = await Position.findOne({ userId: bot.row.userId, id: bot.openPositionId! });
            if (!pos || pos.status !== 'OPEN') {
                bot.openPositionId = null;
                bot.openSide = null;
            }
        } catch { /* transient read failure; next bar retries */ }
    }

    /** Chain work on an account queue so margin checks never interleave. */
    private onAccount(accountId: string, fn: () => Promise<void>): Promise<void> {
        const tail = this.accountQueues.get(accountId) ?? Promise.resolve();
        const next = tail.then(fn).catch(e => console.error('[Bots] queue error:', e.message));
        this.accountQueues.set(accountId, next);
        return next;
    }
}

/** Process-wide runner, wired at boot in server.ts. */
export const botRunner = new BotRunner();
