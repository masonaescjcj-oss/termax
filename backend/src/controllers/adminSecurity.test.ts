/**
 * The admin surface's security properties.
 *
 * Three holes this pins shut, each of which was reachable from outside:
 *
 *   1. The offline Telegram session token was the string
 *      `mock_access_token_<telegramId>` and the middleware accepted it on
 *      sight. Telegram ids are not secret, so anyone could hold any
 *      Telegram user's session by typing one.
 *   2. A lottie key became a filename with no checking, so `nft_../../x`
 *      wrote and deleted `.json` files outside the uploads directory.
 *   3. The community-admin lookup interpolated the caller's text into a
 *      PostgREST `.or()` filter, where a comma is syntax rather than data.
 *
 * Run with:  npx ts-node src/controllers/adminSecurity.test.ts
 */

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-key';
process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';

import fs from 'fs';
import path from 'path';

/* eslint-disable @typescript-eslint/no-var-requires */
const { issueFallbackToken, readFallbackToken } = require('../middleware/auth');
const admin = require('./adminController');
const { supabase } = require('../config/supabase');

let passed = 0;
const failures: string[] = [];
function check(name: string, got: unknown, want: unknown) {
    if (got === want) passed++;
    else failures.push(`${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
}
function section(t: string) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`); }

/** Minimal express double: records the status and body a handler sends. */
function fakeRes() {
    const out: any = { statusCode: 200, body: null };
    out.status = (c: number) => { out.statusCode = c; return out; };
    out.json = (b: any) => { out.body = b; return out; };
    return out;
}

async function main() {

// ── the offline session token ────────────────────────────────────────
section('an offline session token cannot be forged');

const real = issueFallbackToken('123456789');
check('a token we issued reads back as its subject', readFallbackToken(real), '123456789');

// This is exactly what an attacker would send, and exactly what the old
// middleware accepted.
check('the old unsigned form is refused', readFallbackToken('mock_access_token_123456789'), null);
check('a guessed signature is refused', readFallbackToken('mock_access_token_123456789.' + 'a'.repeat(32)), null);
check('a short signature is refused', readFallbackToken('mock_access_token_123456789.abc'), null);

// Someone else's id, signed with our own token's signature.
const [, sig] = real.replace('mock_access_token_', '').split('.');
check('a signature does not travel to another id', readFallbackToken(`mock_access_token_987654321.${sig}`), null);

check('an unrelated string is not a session', readFallbackToken('Bearer nonsense'), null);
check('the empty subject is refused', readFallbackToken('mock_access_token_.' + sig), null);

// ── the lottie key is a filename, not a path ─────────────────────────
section('a lottie key cannot escape the uploads directory');

const uploads = path.join(__dirname, '../../public/uploads/lotties');
const canary = path.join(uploads, '../../../canary.json');
fs.mkdirSync(uploads, { recursive: true });
fs.writeFileSync(canary, '{"keep":true}', 'utf8');

// The list file is what the handler checks membership against; put the
// traversal key in it so the only thing standing between the request and
// the unlink is the key check itself.
const listFile = path.join(uploads, 'list.json');
fs.writeFileSync(listFile, JSON.stringify([{ key: '../../../canary', name: 'x', url: '' }]), 'utf8');

const delRes = fakeRes();
await admin.deleteLottie({ params: { key: '../../../canary' } } as any, delRes as any);
check('the traversing delete is refused', delRes.statusCode, 400);
check('and the file outside the directory is still there', fs.existsSync(canary), true);

const upRes = fakeRes();
await admin.uploadLottie(
    { body: { name: 'x', key: '../../../pwned', lottieJson: '{}' } } as any,
    upRes as any);
check('the traversing upload is refused', upRes.statusCode, 400);
check('and nothing was written outside', fs.existsSync(path.join(uploads, '../../../pwned.json')), false);

fs.unlinkSync(canary);
fs.writeFileSync(listFile, '[]', 'utf8');

// ── the community lookup takes a value, not a filter ─────────────────
section('the community lookup cannot be steered by its input');

// Record what actually reaches PostgREST.
const calls: { method: string; args: any[] }[] = [];
const chain: any = new Proxy({}, {
    get: (_t, prop: string) => {
        if (prop === 'then') return undefined;              // not a promise
        if (prop === 'maybeSingle' || prop === 'single') {
            return async () => ({ data: null, error: null });
        }
        return (...args: any[]) => { calls.push({ method: prop, args }); return chain; };
    },
});
(supabase as any).from = (table: string) => {
    calls.push({ method: 'from', args: [table] });
    // The handler reads the community first; hand it one so it proceeds.
    if (table === 'communities') {
        return new Proxy({}, {
            get: (_t, prop: string) => {
                if (prop === 'single') {
                    return async () => ({ data: { id: 'c1', members: [], admins: [], moderators: [], member_count: 0 }, error: null });
                }
                if (prop === 'then') return undefined;
                return () => (supabase as any).from('communities');
            },
        }) as any;
    }
    return chain;
};

const injection = 'victim,role.eq.admin';
const asgRes = fakeRes();
await admin.assignCommunityAdmin(
    { params: { id: 'c1' }, body: { targetUserIdentifier: injection, role: 'admin' }, user: { id: 'me' } } as any,
    asgRes as any);

check('no .or() filter is built at all', calls.some(c => c.method === 'or'), false);
const ilike = calls.filter(c => c.method === 'ilike');
check('the identifier is passed as a value', ilike.length > 0, true);
check('and passed whole, not spliced into syntax', ilike[0]?.args[1], injection);
check('a user that does not exist is reported as such', asgRes.statusCode, 404);

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
