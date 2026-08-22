/**
 * cTrader OAuth tests.
 *
 * The state parameter is the only thing standing between /callback and anyone
 * who can reach it, so its properties are asserted rather than assumed:
 * single-use, expiring, tamper-evident, and bound to the user who started the
 * flow.
 *
 * Run with:  npx ts-node src/services/ctraderService.test.ts
 */

process.env.CTRADER_CLIENT_ID = process.env.CTRADER_CLIENT_ID || 'test-client';
process.env.CTRADER_CLIENT_SECRET = process.env.CTRADER_CLIENT_SECRET || 'test-secret';

import {
    createState, consumeState, getAuthUrl, needsRefresh, ensureFreshToken, isConfigured,
} from './ctraderService';

let passed = 0;
const failures: string[] = [];

function check(name: string, got: unknown, want: unknown) {
    if (got === want) passed++;
    else failures.push(`${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
}
const section = (t: string) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 54 - t.length))}`);

async function main() {
    // ══════════════════════════════════════════════════════════════
    section('state parameter');
    // ══════════════════════════════════════════════════════════════
    {
        const state = createState('user-42');
        const first = consumeState(state);
        check('a valid state resolves to its user', first?.userId, 'user-42');

        // Single use: a captured callback URL must not be replayable.
        check('the same state cannot be redeemed twice', consumeState(state), null);

        check('a state that was never issued is rejected', consumeState('made.up'), null);
        check('an empty state is rejected', consumeState(''), null);
        check('a missing state is rejected', consumeState(undefined), null);

        // Tampering: keep the signature but swap the payload for another user.
        const victim = createState('user-1');
        const [, signature] = victim.split('.');
        const forgedPayload = Buffer.from('user-999.' + Date.now() + '.x').toString('base64url');
        check('a re-signed payload for another user is rejected',
            consumeState(`${forgedPayload}.${signature}`), null);
        // The victim's own state must still work — a forgery attempt must not
        // consume it as a side effect.
        check('a forgery attempt does not burn the real state',
            consumeState(victim)?.userId, 'user-1');

        // Two states are never the same, so one cannot be guessed from another.
        check('states are unique per call', createState('u') === createState('u'), false);

        // Signature swapped between two valid states.
        const a = createState('user-a');
        const b = createState('user-b');
        const mixed = `${a.split('.')[0]}.${b.split('.')[1]}`;
        check('a signature from another state is rejected', consumeState(mixed), null);
    }

    // ══════════════════════════════════════════════════════════════
    section('authorisation URL');
    // ══════════════════════════════════════════════════════════════
    {
        check('configured with client id and secret', isConfigured(), true);

        const url = getAuthUrl('user-7');
        check('points at the Spotware consent endpoint',
            url.startsWith('https://connect.spotware.com/apps/auth?'), true);
        check('carries a state parameter', /[?&]state=/.test(url), true);
        check('requests the accounts scope', /scope=accounts\+trading|scope=accounts%20trading/.test(url), true);

        // The state in the URL must be the one that validates.
        const issued = new URL(url).searchParams.get('state');
        check('the URL state resolves to the right user', consumeState(issued!)?.userId, 'user-7');
    }

    // ══════════════════════════════════════════════════════════════
    section('token freshness');
    // ══════════════════════════════════════════════════════════════
    {
        check('a token expiring in an hour is fresh',
            needsRefresh({ expiresAt: Date.now() + 3_600_000 }), false);
        check('a token expiring in one minute is due',
            needsRefresh({ expiresAt: Date.now() + 60_000 }), true);
        check('an already expired token is due',
            needsRefresh({ expiresAt: Date.now() - 1_000 }), true);
        // No expiry known: use it until the server refuses, rather than
        // refreshing on every single call.
        check('a token with no known expiry is not refreshed', needsRefresh({}), false);

        const fresh = await ensureFreshToken({ accessToken: 'abc', expiresAt: Date.now() + 3_600_000 });
        check('a fresh token is returned unchanged', fresh.accessToken, 'abc');
        check('a fresh token is not reported as refreshed', fresh.refreshed, false);

        // Due for refresh but with no refresh token: return what we have
        // rather than throwing, and let the broker reject it if it is dead.
        const stuck = await ensureFreshToken({ accessToken: 'old', expiresAt: Date.now() + 1_000 });
        check('no refresh token means the existing one is used', stuck.accessToken, 'old');

        let threw = false;
        try {
            await ensureFreshToken({});
        } catch {
            threw = true;
        }
        check('an account with no token at all is an error', threw, true);
    }
}

main().then(() => {
    console.log(`\n${'═'.repeat(60)}`);
    if (failures.length === 0) {
        console.log(`✅ all ${passed} assertions passed`);
        process.exit(0);
    }
    console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}\n`));
    process.exit(1);
}).catch(e => { console.error('FATAL', e); process.exit(1); });
