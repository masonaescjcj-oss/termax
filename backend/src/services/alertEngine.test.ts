/**
 * The alert engine's pure parts: the hit test and the in-memory index.
 * Run: npx ts-node src/services/alertEngine.test.ts
 */
import assert from 'assert';

// The engine's imports reach the Supabase client, which insists on a URL at
// load time; the tests never touch the network.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-key';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { alertEngine, alertHit } = require('./alertEngine') as typeof import('./alertEngine');
type PriceAlertRow = import('../models/PriceAlert').PriceAlertRow;

const row = (over: Partial<PriceAlertRow>): PriceAlertRow => ({
    id: 'a1', userId: 'u1', symbol: 'GOLD', price: 2400, condition: 'above', note: null,
    status: 'active', triggeredAt: null, triggeredPrice: null, createdAt: new Date(), ...over,
});

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };

console.log('alertEngine');

test('above fires at or past the level, not before', () => {
    assert.equal(alertHit({ condition: 'above', price: 2400 }, 2399.99), false);
    assert.equal(alertHit({ condition: 'above', price: 2400 }, 2400), true);
    assert.equal(alertHit({ condition: 'above', price: 2400 }, 2450), true);
});

test('below fires at or under the level', () => {
    assert.equal(alertHit({ condition: 'below', price: 2400 }, 2400.01), false);
    assert.equal(alertHit({ condition: 'below', price: 2400 }, 2400), true);
});

test('a non-finite price never fires', () => {
    assert.equal(alertHit({ condition: 'above', price: 1 }, NaN), false);
    assert.equal(alertHit({ condition: 'below', price: 1 }, Infinity), false);
});

test('check() fires only matching alerts for that symbol and removes them from the index', () => {
    alertEngine.reset();
    alertEngine.add(row({ id: 'a1', symbol: 'GOLD', price: 2400, condition: 'above' }));
    alertEngine.add(row({ id: 'a2', symbol: 'GOLD', price: 2300, condition: 'below' }));
    alertEngine.add(row({ id: 'a3', symbol: 'BTC/USDT', price: 60000, condition: 'above' }));
    assert.deepEqual(alertEngine.symbols().sort(), ['BTC/USDT', 'GOLD']);
    assert.equal(alertEngine.size(), 3);

    const fired: string[] = [];
    const hits = alertEngine.check('GOLD', 2405, a => { fired.push(a.id); });
    assert.deepEqual(hits.map(h => h.id), ['a1']);
    assert.deepEqual(fired, ['a1']);
    assert.equal(alertEngine.size(), 2);

    // The same tick again does not re-fire the removed alert.
    assert.deepEqual(alertEngine.check('GOLD', 2405, () => undefined), []);
    // A symbol with no alerts is a no-op.
    assert.deepEqual(alertEngine.check('EUR/USD', 1.1, () => undefined), []);
});

test('remove() drops an alert and forgets an emptied symbol', () => {
    alertEngine.reset();
    const a = row({ id: 'x', symbol: 'SPX', price: 5000 });
    alertEngine.add(a);
    alertEngine.remove(a);
    assert.equal(alertEngine.size(), 0);
    assert.deepEqual(alertEngine.symbols(), []);
});

test('an inactive row is never indexed', () => {
    alertEngine.reset();
    alertEngine.add(row({ id: 't', status: 'triggered' }));
    assert.equal(alertEngine.size(), 0);
});

console.log(`\n${passed} passed`);
