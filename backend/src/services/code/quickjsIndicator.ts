/**
 * CODE-TIER INDICATORS — real JavaScript, inside a cage. PRO only.
 *
 * The expression tier is safe by construction; this tier is safe by
 * CONFINEMENT: user code runs in QuickJS compiled to WASM — a separate
 * interpreter inside the Node process with no access to Node, the fs,
 * the network, or anything we do not hand it. On top of the wall:
 *
 *  - a hard deadline enforced by the engine's interrupt handler
 *    (an infinite loop dies mid-iteration, not "eventually");
 *  - a memory ceiling on the QuickJS runtime;
 *  - forced determinism: Math.random throws, Date is frozen at epoch —
 *    an indicator that cannot reproduce itself is not an indicator;
 *  - a fresh context per run: nothing survives between runs or between
 *    users.
 *
 * Contract for the user's code: define  function calc(bars)  where bars
 * is [{time, open, high, low, close, volume}] oldest-first, and return
 * either an array of numbers aligned to bars (NaN/null = no value) or
 * an array of {time, value}.
 *
 * Why isolated-vm was never an option: its August 2026 escape is the
 * whole reason this tier is WASM. A bug in QuickJS-WASM corrupts its own
 * sandbox memory, not the process.
 */

import { getQuickJS, QuickJSContext } from 'quickjs-emscripten';
import { Bar } from '../strategy/types';

export const CODE_MAX_LENGTH = 4000;
const DEFAULT_TIMEOUT_MS = 100;
const MEMORY_LIMIT_BYTES = 16 * 1024 * 1024;
const STACK_SIZE_BYTES = 512 * 1024;
const MAX_OUTPUT_VALUES = 5000;

export interface CodeRunOk { ok: true; values: Array<{ time: number; value: number }> }
export interface CodeRunErr { ok: false; error: string }

/**
 * The prelude runs before user code, in the same cage: it removes the
 * non-determinism QuickJS ships with. Frozen, so user code cannot
 * restore it.
 */
const PRELUDE = `
Math.random = function () { throw new Error('Math.random is disabled: indicators must be deterministic'); };
Date.now = function () { return 0; };
Date = function () { throw new Error('Date is disabled: indicators must be deterministic'); };
`;

export async function runCodeIndicator(
    code: string,
    bars: Bar[],
    opts: { timeoutMs?: number } = {}
): Promise<CodeRunOk | CodeRunErr> {
    if (typeof code !== 'string' || !code.trim()) return { ok: false, error: 'Code is empty.' };
    if (code.length > CODE_MAX_LENGTH) return { ok: false, error: `Code longer than ${CODE_MAX_LENGTH} characters.` };

    const QuickJS = await getQuickJS();
    const runtime = QuickJS.newRuntime();
    runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
    runtime.setMaxStackSize(STACK_SIZE_BYTES);

    const deadline = Date.now() + Math.min(1000, Math.max(20, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS));
    runtime.setInterruptHandler(() => Date.now() > deadline);

    const vm: QuickJSContext = runtime.newContext();
    try {
        const barsJson = JSON.stringify(bars.map(b => ({
            time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
        })));

        const program = `${PRELUDE}
${code}
;(function () {
    if (typeof calc !== 'function') {
        throw new Error('Define  function calc(bars)  — it was not found.');
    }
    var bars = ${barsJson};
    var out = calc(bars);
    if (!Array.isArray(out)) {
        throw new Error('calc(bars) must return an array (numbers aligned to bars, or {time, value} objects).');
    }
    var values = [];
    for (var i = 0; i < out.length && values.length < ${MAX_OUTPUT_VALUES}; i++) {
        var v = out[i];
        if (v === null || v === undefined) continue;
        if (typeof v === 'number') {
            if (isFinite(v) && bars[i]) values.push({ time: bars[i].time, value: v });
        } else if (typeof v === 'object' && typeof v.time === 'number' && typeof v.value === 'number') {
            if (isFinite(v.value)) values.push({ time: v.time, value: v.value });
        }
    }
    return JSON.stringify(values);
})()`;

        const result = vm.evalCode(program);
        if (result.error) {
            const err = vm.dump(result.error);
            result.error.dispose();
            const msg = typeof err === 'object' && err?.message ? String(err.message) : String(err);
            return { ok: false, error: msg.includes('interrupted') ? 'Time limit exceeded (100ms). Simplify the calculation.' : msg };
        }
        const raw = vm.dump(result.value);
        result.value.dispose();

        let values: Array<{ time: number; value: number }>;
        try {
            values = JSON.parse(String(raw));
        } catch {
            return { ok: false, error: 'The sandbox returned an unreadable result.' };
        }
        return { ok: true, values };
    } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (msg.includes('interrupted')) return { ok: false, error: 'Time limit exceeded (100ms). Simplify the calculation.' };
        if (msg.toLowerCase().includes('memory') || msg.includes('out of memory')) return { ok: false, error: 'Memory limit exceeded (16MB).' };
        return { ok: false, error: msg };
    } finally {
        vm.dispose();
        runtime.dispose();
    }
}
