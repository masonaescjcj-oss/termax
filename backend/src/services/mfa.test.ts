/** Token inspection for two-factor. Run: npx ts-node src/services/mfa.test.ts */
import assert from 'assert';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-key';
/* eslint-disable @typescript-eslint/no-var-requires */
const { aalOf } = require('./mfa') as typeof import('./mfa');

const jwt = (payload: any) => {
    const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature`;
};

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };

console.log('mfa');

test('reads the assurance level from a session token', () => {
    assert.equal(aalOf(jwt({ sub: 'u1', aal: 'aal2' })), 'aal2');
    assert.equal(aalOf(jwt({ sub: 'u1', aal: 'aal1' })), 'aal1');
});

test('a token without the claim is not aal2', () => {
    assert.equal(aalOf(jwt({ sub: 'u1' })), null);
    assert.notEqual(aalOf(jwt({ sub: 'u1' })), 'aal2');
});

test('a malformed token is never mistaken for a verified one', () => {
    for (const bad of ['', 'not-a-token', 'a.b', 'a..c', 'x.@@@.z', jwt({ aal: 2 })]) {
        assert.notEqual(aalOf(bad), 'aal2', `"${bad}" must not read as aal2`);
    }
});

test('base64url payloads with - and _ decode', () => {
    // A payload whose base64 contains the URL-safe substitutions.
    const token = aalOf(jwt({ sub: 'u1', aal: 'aal2', note: '??>>??>>' }));
    assert.equal(token, 'aal2');
});

console.log(`\n${passed} passed`);
