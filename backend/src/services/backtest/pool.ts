/**
 * BACKTEST POOL — two workers, a queue, and per-user fairness.
 *
 * Sized for the $25 server: two concurrent backtests keep one core busy
 * while the other serves the live path. Each user can hold at most two
 * slots (running + queued combined), so one enthusiastic user cannot
 * starve everyone else's backtests. A hard timeout kills runaways.
 */

import path from 'path';
import { Worker } from 'worker_threads';
import { StrategySpec } from '../strategy/types';
import { BacktestOptions, BacktestResult } from './engine';
import { HonestyReport } from './honesty';

const POOL_SIZE = 2;
const PER_USER_LIMIT = 2;
const JOB_TIMEOUT_MS = 180_000;

export interface BacktestJobOutput {
    result: BacktestResult;
    honesty: HonestyReport;
}

interface QueuedJob {
    userId: string;
    payload: {
        spec: StrategySpec;
        fromMs: number;
        toMs: number;
        options: BacktestOptions;
        candleRoot?: string;
    };
    resolve: (out: BacktestJobOutput) => void;
    reject: (err: Error) => void;
}

/** In dev ts-node runs .ts sources; in production the compiled .js runs. */
function workerEntry(): { file: string; execArgv: string[] } {
    if (__filename.endsWith('.ts')) {
        return { file: path.join(__dirname, 'worker.ts'), execArgv: ['--require', 'ts-node/register'] };
    }
    return { file: path.join(__dirname, 'worker.js'), execArgv: [] };
}

export class BacktestPool {
    private queue: QueuedJob[] = [];
    private running = 0;
    private perUser = new Map<string, number>();

    /** Running + queued jobs for a user. */
    load(userId: string): number {
        return this.perUser.get(userId) ?? 0;
    }

    run(userId: string, payload: QueuedJob['payload']): Promise<BacktestJobOutput> {
        if (this.load(userId) >= PER_USER_LIMIT) {
            return Promise.reject(new Error(`You already have ${PER_USER_LIMIT} backtests in flight — wait for one to finish.`));
        }
        this.perUser.set(userId, this.load(userId) + 1);
        return new Promise<BacktestJobOutput>((resolve, reject) => {
            this.queue.push({ userId, payload, resolve, reject });
            this.pump();
        });
    }

    private pump(): void {
        while (this.running < POOL_SIZE && this.queue.length) {
            const job = this.queue.shift()!;
            this.running++;
            this.execute(job).finally(() => {
                this.running--;
                const left = this.load(job.userId) - 1;
                if (left > 0) this.perUser.set(job.userId, left);
                else this.perUser.delete(job.userId);
                this.pump();
            });
        }
    }

    private execute(job: QueuedJob): Promise<void> {
        return new Promise<void>((done) => {
            const { file, execArgv } = workerEntry();
            let settled = false;
            const finish = (fn: () => void) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                fn();
                done();
            };

            let worker: Worker;
            try {
                worker = new Worker(file, { workerData: job.payload, execArgv });
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                finish(() => job.reject(new Error(`Could not start backtest worker: ${msg}`)));
                return;
            }

            const timer = setTimeout(() => {
                worker.terminate().catch(() => undefined);
                finish(() => job.reject(new Error('Backtest timed out (180s). Narrow the date range.')));
            }, JOB_TIMEOUT_MS);

            worker.once('message', (msg: any) => {
                worker.terminate().catch(() => undefined);
                if (msg?.ok) finish(() => job.resolve({ result: msg.result, honesty: msg.honesty }));
                else finish(() => job.reject(new Error(msg?.error ?? 'Backtest failed.')));
            });
            worker.once('error', (e: any) => {
                finish(() => job.reject(new Error(`Backtest worker error: ${e?.message ?? String(e)}`)));
            });
            worker.once('exit', (code) => {
                if (code !== 0) finish(() => job.reject(new Error(`Backtest worker exited with code ${code}.`)));
            });
        });
    }
}

/** Process-wide pool. */
export const backtestPool = new BacktestPool();
