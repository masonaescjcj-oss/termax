/**
 * Where the AI key comes from, and what happens when it stops working.
 *
 * The key used to live in a JSON file beside the source. A redeploy
 * rebuilt the container, took the file with it, and `loadAIConfig` fell
 * back to AI_API_KEY from the environment — the very key the admin had
 * replaced because it was dead. Nothing said so: the console still reported
 * a key as stored, and users still got errors. These tests pin the order of
 * precedence, that a save is never reported as done when it was not, and
 * that a provider failure is described in words an admin can act on.
 *
 * Run with:  npx ts-node src/utils/aiConfig.test.ts
 */

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-key';
process.env.AI_API_KEY = 'env-key';

/* eslint-disable @typescript-eslint/no-var-requires */
const { supabase } = require('../config/supabase');
const cfg = require('./aiConfigManager');
const { describe: describeErr, recordAIOk, recordAIFailure, aiHealth, __resetAIHealth } = require('../services/aiHealth');

let passed = 0;
const failures: string[] = [];
function check(name: string, got: unknown, want: unknown) {
    if (got === want) passed++;
    else failures.push(`${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
}
function section(t: string) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`); }

// ── a settings table we control ──────────────────────────────────────
let row: any = null;
let upsertError: string | null = null;
let upserted: any = null;

(supabase as any).from = (table: string) => {
    if (table !== 'app_settings') throw new Error(`unexpected table ${table}`);
    const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: row, error: null }),
        upsert: async (payload: any) => {
            if (upsertError) return { error: { message: upsertError } };
            upserted = payload;
            row = { value: payload.value };
            return { error: null };
        },
    };
    return chain;
};

async function main() {

// ── precedence ───────────────────────────────────────────────────────
section('the stored key wins over the environment');

// This checkout still carries the legacy backend/src/ai_config.json — with
// blank keys, which is the shape that means "use the environment". So with
// nothing in the database, the file supplies the URLs and the key falls
// through to the environment. That is exactly the state a deployment is in
// before anyone presses Save, and the source has to name it, because a file
// is what the next redeploy deletes.
row = null;
cfg.invalidateAIConfigCache();
let c = await cfg.loadAIConfig();
check('the key falls through to the environment', c.apiKey, 'env-key');
check('and the console is told the config is on disk', cfg.configSource(), 'legacy-file');

row = { value: { apiKey: 'db-key', baseUrl: 'https://db.example/v1', modelName: 'db-model' } };
cfg.invalidateAIConfigCache();
c = await cfg.loadAIConfig();
check('a stored key beats both the file and the environment', c.apiKey, 'db-key');
check('along with its base URL', c.baseUrl, 'https://db.example/v1');
check('and the console sees the database', cfg.configSource(), 'database');

// A blank stored key means "use the environment" — that is how the config
// can be committed without a credential in it.
row = { value: { apiKey: '', baseUrl: 'https://db.example/v1', modelName: 'db-model' } };
cfg.invalidateAIConfigCache();
c = await cfg.loadAIConfig();
check('a blank stored key falls through to the environment', c.apiKey, 'env-key');
check('without losing the rest of the stored config', c.modelName, 'db-model');

// ── the cache must not outlive a save ────────────────────────────────
section('a saved key reaches the next request');

row = { value: { apiKey: 'old-key', baseUrl: 'b', modelName: 'm' } };
cfg.invalidateAIConfigCache();
await cfg.loadAIConfig();                       // warms the cache

upsertError = null;
await cfg.saveAIConfig({ activeProvider: 'nara', apiKey: 'new-key', baseUrl: 'b', modelName: 'm' } as any,
    { id: 'not-a-uuid', username: 'sina' });
c = await cfg.loadAIConfig();
check('the new key is live immediately', c.apiKey, 'new-key');
check('and who saved it was recorded', upserted.updated_by_username, 'sina');
check('a non-uuid actor id is not written as one', upserted.updated_by, null);

// ── a failed save must not look like a success ───────────────────────
section('a save that did not happen says so');

upsertError = 'relation "app_settings" does not exist';
let threw = '';
try {
    await cfg.saveAIConfig({ activeProvider: 'nara', apiKey: 'x', baseUrl: 'b', modelName: 'm' } as any);
} catch (e: any) {
    threw = e.message;
}
check('the save throws', threw.includes('Could not save'), true);
check('and names the migration to run', threw.includes('014_app_settings.sql'), true);
upsertError = null;

// ── provider errors in words ─────────────────────────────────────────
section('a provider error says what to do about it');

check('401 points at the key', describeErr({ status: 401, message: 'nope' }).includes('rejected the API key'), true);
check('429 points at the quota', describeErr({ status: 429, message: 'slow down' }).includes('quota'), true);
check('404 points at the model', describeErr({ status: 404, message: 'no model' }).includes('model'), true);
check('500 points at the provider', describeErr({ status: 503, message: 'oops' }).includes('provider is failing'), true);

// ── health ───────────────────────────────────────────────────────────
section('health reflects what actually happened');

__resetAIHealth();
check('a fresh process has proven nothing', aiHealth().okCount, 0);

recordAIFailure({ status: 401, message: 'bad key' });
recordAIFailure({ status: 401, message: 'bad key' });
check('failures accumulate a streak', aiHealth().failStreak, 2);
check('and the reason is kept', aiHealth().lastFailMessage?.includes('rejected the API key'), true);

recordAIOk('fallback');
check('a success clears the streak', aiHealth().failStreak, 0);
check('and records who actually served it', aiHealth().lastServedBy, 'fallback');

// ── report ───────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(64)}`);
if (failures.length) {
    console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
    failures.forEach(f => console.log(`  ✗ ${f}\n`));
    process.exit(1);
}
console.log(`✅ all ${passed} assertions passed`);
}

main();

// This file uses require() so the environment above is set before the
// modules load, which leaves it without a top-level import — and TypeScript
// treats a file with neither import nor export as a global script, sharing
// one scope with every other one. This makes it a module.
export {};
