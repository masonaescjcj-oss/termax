/**
 * LIVE GATE — the hard rule between paper and real money.
 *
 * A bot goes live only after a COMPLETED forward test: enough calendar time
 * and enough trades on the simulated account (both configurable by env).
 * The gate deliberately does NOT block an unprofitable bot — that is the
 * user's money and their call — but the API requires them to acknowledge a
 * negative expectancy explicitly, so "I didn't notice it was losing" cannot
 * happen. What the gate does block is skipping the forward test.
 */

import { BotRow } from '../../models/Bot';
import { TradeStats } from './tradeStats';

export interface LiveGateRequirements {
    minDays: number;
    minTrades: number;
}

export interface LiveGateVerdict {
    eligible: boolean;
    /** Human-readable reasons the gate is closed (empty when eligible). */
    reasons: string[];
    /** Open even though the record is losing — needs explicit acknowledgement. */
    losingRecord: boolean;
    requirements: LiveGateRequirements;
    progress: {
        daysRunning: number;
        trades: number;
    };
}

export function gateRequirements(): LiveGateRequirements {
    const minDays = Number(process.env.LIVE_GATE_MIN_DAYS);
    const minTrades = Number(process.env.LIVE_GATE_MIN_TRADES);
    return {
        minDays: Number.isFinite(minDays) && minDays >= 0 ? minDays : 14,
        minTrades: Number.isFinite(minTrades) && minTrades >= 0 ? minTrades : 20,
    };
}

export function evaluateLiveGate(row: BotRow, forward: TradeStats, now = Date.now()): LiveGateVerdict {
    const req = gateRequirements();
    const startedMs = row.startedAt ? row.startedAt.getTime() : null;
    // The clock starts when the forward test started, falling back to the
    // first recorded trade for rows predating started_at.
    const clock0 = startedMs ?? forward.firstTradeAt;
    const daysRunning = clock0 !== null ? (now - clock0) / 86_400_000 : 0;

    const reasons: string[] = [];
    if (row.status === 'LIVE') reasons.push('The bot is already live.');
    if (daysRunning < req.minDays) {
        reasons.push(`Forward test has run ${daysRunning.toFixed(1)} of the required ${req.minDays} days.`);
    }
    if (forward.trades < req.minTrades) {
        reasons.push(`Forward test has ${forward.trades} of the required ${req.minTrades} closed trades.`);
    }

    return {
        eligible: reasons.length === 0,
        reasons,
        losingRecord: forward.trades > 0 && forward.expectancy <= 0,
        requirements: req,
        progress: { daysRunning: Number(daysRunning.toFixed(2)), trades: forward.trades },
    };
}
