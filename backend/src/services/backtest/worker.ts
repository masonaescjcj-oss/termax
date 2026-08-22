/**
 * BACKTEST WORKER — runs inside a worker_thread.
 *
 * Node is single-threaded: a two-year 1m backtest plus a dozen sensitivity
 * re-runs is seconds of CPU, and on the main thread those seconds would
 * freeze quote ingestion and stop-loss checks for every user (roadmap §3
 * rule 1: backtests NEVER run on the main thread). The worker reads bars
 * from the binary store itself — the parent sends only the job description.
 */

import { parentPort, workerData } from 'worker_threads';
import { StrategySpec } from '../strategy/types';
import { __setCandleRoot, readBars } from '../candles/store';
import { BacktestOptions, runBacktest } from './engine';
import { gradeBacktest } from './honesty';

interface Job {
    spec: StrategySpec;
    fromMs: number;
    toMs: number;
    options: BacktestOptions;
    /** Explicit so the worker never depends on env-var inheritance quirks. */
    candleRoot?: string;
}

const job = workerData as Job;

try {
    if (job.candleRoot) __setCandleRoot(job.candleRoot);
    const bars = readBars(job.spec.symbol, job.fromMs, job.toMs);
    if (bars.length < 50) {
        parentPort!.postMessage({
            ok: false,
            error: `Not enough stored history for ${job.spec.symbol}: ${bars.length} one-minute bars in the window.`,
        });
    } else {
        const result = runBacktest(job.spec, bars, job.options);
        const honesty = gradeBacktest(job.spec, result, variant => runBacktest(variant, bars, job.options));
        parentPort!.postMessage({ ok: true, result, honesty });
    }
} catch (e: any) {
    parentPort!.postMessage({ ok: false, error: e?.message ?? String(e) });
}
