/**
 * Engine correctness tests.
 *
 * Every expected value here is a real-broker reference figure, not a
 * restatement of what the code does — that is the whole point. The previous
 * engine had no tests, which is how forex ended up 100,000x out.
 *
 * Run with:  npx ts-node src/services/pricing.test.ts
 */

import { getSpec, normaliseVolume, roundPrice } from '../config/instruments';
import {
    setQuote, setMidPrice, __resetQuotes, openPrice, closePrice, getSpreadPips,
    marginRequired, pipValue, grossPnL, unrealizedPnL, realizedPnL,
    rateToAccount, nightlySwap, swapMultiplier, accountMetrics,
    STOP_OUT_LEVEL,
} from './pricing';

// ── tiny assertion harness (no dev-dependency needed) ──────────────
let passed = 0;
const failures: string[] = [];

function check(name: string, got: unknown, want: unknown, tolerance = 0) {
    let ok: boolean;
    if (typeof got === 'number' && typeof want === 'number') {
        ok = Number.isFinite(got) && Math.abs(got - want) <= tolerance;
    } else {
        ok = got === want;
    }
    if (ok) {
        passed++;
    } else {
        const g = typeof got === 'number' ? got.toFixed(6) : String(got);
        const w = typeof want === 'number' ? want.toFixed(6) : String(want);
        failures.push(`${name}\n      got  ${g}\n      want ${w}${tolerance ? ` (±${tolerance})` : ''}`);
    }
}

function section(title: string) {
    console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`);
}

/**
 * Market snapshot used by every test below. Rates chosen so the reference
 * arithmetic is checkable by hand.
 */
function seedMarket() {
    __resetQuotes();
    setQuote('EUR/USD', 1.07500, 1.07501);
    setQuote('GBP/USD', 1.26500, 1.26503);
    setQuote('AUD/USD', 0.66500, 0.66503);
    setQuote('USD/JPY', 158.500, 158.502);
    setQuote('USD/CHF', 0.89500, 0.89504);
    setQuote('USD/CAD', 1.37000, 1.37004);
    setQuote('EUR/JPY', 170.200, 170.206);
    setQuote('GBP/JPY', 200.500, 200.510);
    setQuote('GOLD', 2350.00, 2350.20);
    setQuote('SILVER', 29.500, 29.520);
    setQuote('USOIL', 80.00, 80.03);
    setQuote('BTC/USDT', 63500.0, 63600.0);
    setQuote('SPX', 5450.0, 5450.4);
}

// ══════════════════════════════════════════════════════════════════
section('instrument specs — forex must not be missing');
// ══════════════════════════════════════════════════════════════════
{
    // The exact regression that broke the engine: these were absent, so
    // contractSize fell back to 1.
    for (const sym of ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'GBP/JPY', 'EUR/GBP']) {
        check(`${sym} contractSize is 100,000`, getSpec(sym).contractSize, 100_000);
    }
    check('EUR/USD digits', getSpec('EUR/USD').digits, 5);
    check('EUR/USD pipSize', getSpec('EUR/USD').pipSize, 0.0001, 1e-12);
    check('USD/JPY digits (JPY pairs quote to 3)', getSpec('USD/JPY').digits, 3);
    check('USD/JPY pipSize (JPY pip is 0.01)', getSpec('USD/JPY').pipSize, 0.01, 1e-12);
    check('GOLD contractSize is 100 oz', getSpec('GOLD').contractSize, 100);
    check('SILVER contractSize is 5000 oz', getSpec('SILVER').contractSize, 5_000);
    check('USOIL contractSize is 1000 bbl', getSpec('USOIL').contractSize, 1_000);
    check('BTC contractSize is 1', getSpec('BTC/USDT').contractSize, 1);

    // An unknown forex pair must infer a 100k contract, never 1.
    check('unknown pair NOK/SEK infers 100k', getSpec('NOK/SEK').contractSize, 100_000);
    check('unknown pair is classed FOREX', getSpec('NOK/SEK').assetClass, 'FOREX');
}

// ══════════════════════════════════════════════════════════════════
section('bid/ask execution sides');
// ══════════════════════════════════════════════════════════════════
{
    seedMarket();
    check('BUY fills at ask', openPrice('EUR/USD', 'BUY'), 1.07501, 1e-9);
    check('SELL fills at bid', openPrice('EUR/USD', 'SELL'), 1.07500, 1e-9);
    check('long closes at bid', closePrice('EUR/USD', 'BUY'), 1.07500, 1e-9);
    check('short closes at ask', closePrice('EUR/USD', 'SELL'), 1.07501, 1e-9);
    check('EUR/USD spread reads 0.1 pip', getSpreadPips('EUR/USD')!, 0.1, 1e-6);
    check('GOLD spread reads 20 pips ($0.20)', getSpreadPips('GOLD')!, 20, 1e-6);

    // Round-tripping immediately must cost the spread, never make money.
    const entry = openPrice('EUR/USD', 'BUY')!;
    const exit = closePrice('EUR/USD', 'BUY')!;
    const rt = grossPnL('EUR/USD', 'BUY', 1.0, entry, exit)!;
    check('instant round trip on 1 lot loses the spread', rt, -1.0, 0.01);

    // Synthesised quotes from a one-sided feed must straddle the mid.
    __resetQuotes();
    setMidPrice('EUR/USD', 1.07500);
    check('synth ask above mid', openPrice('EUR/USD', 'BUY')! > 1.075, true);
    check('synth bid below mid', openPrice('EUR/USD', 'SELL')! < 1.075, true);
    // A synthesised spread cannot be finer than the instrument's tick, so it
    // is rounded outward: never tighter than the spec, at most a tick wider.
    {
        const spec = getSpec('EUR/USD');
        const got = getSpreadPips('EUR/USD')!;
        const tickInPips = Math.pow(10, -spec.digits) / spec.pipSize;
        check('synth spread never tighter than spec', got >= spec.typicalSpreadPips - 1e-9, true);
        check('synth spread within a tick of spec', got <= spec.typicalSpreadPips + 2 * tickInPips + 1e-9, true);
    }
    // GOLD's 20-pip spread is many ticks wide, so it reproduces exactly.
    check('synth GOLD spread is exact', (() => { setMidPrice('GOLD', 2350.10); return getSpreadPips('GOLD')!; })(), 20, 1e-6);
}

// ══════════════════════════════════════════════════════════════════
section('currency conversion');
// ══════════════════════════════════════════════════════════════════
{
    seedMarket();
    check('USD -> USD is 1', rateToAccount('USD'), 1);
    check('EUR -> USD reads EUR/USD', rateToAccount('EUR')!, 1.075005, 1e-5);
    // JPY has no JPY/USD pair, so it must invert USD/JPY.
    check('JPY -> USD inverts USD/JPY', rateToAccount('JPY')!, 1 / 158.501, 1e-9);
    check('CHF -> USD inverts USD/CHF', rateToAccount('CHF')!, 1 / 0.89502, 1e-9);
    check('XAU -> USD uses GOLD price', rateToAccount('XAU')!, 2350.1, 0.11);
    check('unquoted currency yields undefined', rateToAccount('ZWL'), undefined);
}

// ══════════════════════════════════════════════════════════════════
section('margin — reference: notional in base x rate x marginRate');
// ══════════════════════════════════════════════════════════════════
{
    seedMarket();
    // 1.00 lot EUR/USD = 100,000 EUR = $107,500 notional, 1:200 => $537.50
    check('1.00 lot EUR/USD margin', marginRequired('EUR/USD', 1.0)!, 537.50, 0.02);
    check('0.10 lot EUR/USD margin', marginRequired('EUR/USD', 0.1)!, 53.75, 0.01);

    // USD/JPY base is USD: 100,000 USD / 200 = $500 whatever the rate.
    check('1.00 lot USD/JPY margin is rate-independent', marginRequired('USD/JPY', 1.0)!, 500.00, 0.01);

    // GBP/JPY base is GBP: 0.5 x 100,000 GBP x 1.265 / 100 (1:100 minor) = $632.50
    check('0.50 lot GBP/JPY margin', marginRequired('GBP/JPY', 0.5)!, 632.51, 0.05);

    // GOLD: 0.1 x 100 oz x $2350.10 / 200 = $117.51
    check('0.10 lot GOLD margin', marginRequired('GOLD', 0.1)!, 117.51, 0.02);

    // BTC at 1:10: 0.1 x 1 x 63,550 x 0.1 = $635.50
    check('0.10 lot BTC margin', marginRequired('BTC/USDT', 0.1)!, 635.50, 1.0);

    check('unquoted symbol gives undefined margin', marginRequired('XXX/YYY', 1), undefined);
}

// ══════════════════════════════════════════════════════════════════
section('pip value — reference: EUR/USD $10, USD/JPY ~$6.31 per lot');
// ══════════════════════════════════════════════════════════════════
{
    seedMarket();
    check('EUR/USD 1.00 lot pip', pipValue('EUR/USD', 1.0)!, 10.00, 0.001);
    check('EUR/USD 0.10 lot pip', pipValue('EUR/USD', 0.1)!, 1.00, 0.001);
    check('AUD/USD 1.00 lot pip', pipValue('AUD/USD', 1.0)!, 10.00, 0.001);
    // 0.01 x 100,000 JPY = 1,000 JPY, / 158.501 = $6.309
    check('USD/JPY 1.00 lot pip', pipValue('USD/JPY', 1.0)!, 6.3091, 0.001);
    check('GBP/JPY 1.00 lot pip', pipValue('GBP/JPY', 1.0)!, 6.3091, 0.001);
    // GOLD pip is $0.01 on 100 oz = $1.00
    check('GOLD 1.00 lot pip', pipValue('GOLD', 1.0)!, 1.00, 0.001);
    // USOIL pip is $0.01 on 1,000 bbl = $10.00
    check('USOIL 1.00 lot pip', pipValue('USOIL', 1.0)!, 10.00, 0.001);
}

// ══════════════════════════════════════════════════════════════════
section('P/L — reference figures a broker statement would show');
// ══════════════════════════════════════════════════════════════════
{
    seedMarket();
    // +50 pips on 1.00 lot EUR/USD = $500
    check('EUR/USD long +50 pips', grossPnL('EUR/USD', 'BUY', 1.0, 1.07500, 1.08000)!, 500.00, 0.01);
    // -10 pips on 0.10 lot = -$10
    check('EUR/USD long -10 pips (0.1 lot)', grossPnL('EUR/USD', 'BUY', 0.1, 1.07500, 1.07400)!, -10.00, 0.01);
    // A short profits when price falls.
    check('EUR/USD short +50 pips', grossPnL('EUR/USD', 'SELL', 1.0, 1.08000, 1.07500)!, 500.00, 0.01);

    // +50 pips on 1.00 lot USD/JPY = 50,000 JPY = $315.46 at 158.501
    check('USD/JPY long +50 pips', grossPnL('USD/JPY', 'BUY', 1.0, 158.500, 159.000)!, 315.46, 0.05);
    // 0.5 lot GBP/JPY short, 100 pips = 50,000 JPY = $315.46
    check('GBP/JPY short +100 pips (0.5 lot)', grossPnL('GBP/JPY', 'SELL', 0.5, 200.500, 199.500)!, 315.46, 0.05);

    // Metals & crypto were already right before the fix — must stay right.
    check('GOLD long +$10 (0.1 lot)', grossPnL('GOLD', 'BUY', 0.1, 2350.00, 2360.00)!, 100.00, 0.01);
    check('BTC long +$1000 (0.1 lot)', grossPnL('BTC/USDT', 'BUY', 0.1, 63500, 64500)!, 100.00, 0.01);

    // Costs must actually reduce P/L.
    const pos = { symbol: 'EUR/USD', side: 'BUY' as const, volume: 1.0, entryPrice: 1.07000, commission: 7, swap: -2.5 };
    check('realized P/L nets commission and swap',
        realizedPnL(pos, 1.07500)!, 500.00 - 7 - 2.5, 0.01);
    check('unrealized P/L values a long at the bid',
        unrealizedPnL(pos)!, (1.07500 - 1.07000) * 100_000 - 7 - 2.5, 0.01);
    check('unrealized P/L is undefined for an unquoted symbol',
        unrealizedPnL({ ...pos, symbol: 'XXX/YYY' }), undefined);
}

// ══════════════════════════════════════════════════════════════════
section('swap / overnight financing');
// ══════════════════════════════════════════════════════════════════
{
    seedMarket();
    const wed = new Date(Date.UTC(2026, 7, 19)); // Wednesday
    const thu = new Date(Date.UTC(2026, 7, 20)); // Thursday
    check('Wednesday books triple swap', swapMultiplier(wed), 3);
    check('other days book single swap', swapMultiplier(thu), 1);

    const long = { symbol: 'EUR/USD' as const, side: 'BUY' as const, volume: 1.0 };
    const oneNight = nightlySwap(long, thu)!;
    // 100,000 EUR x 1.075 x -1.5% / 365 = -$4.42
    check('1 lot EUR/USD long one night', oneNight, -4.4178, 0.01);
    check('Wednesday is exactly 3 nights', nightlySwap(long, wed)!, oneNight * 3, 0.001);
    check('a long is charged (negative)', oneNight < 0, true);
    check('a short pays less than a long here',
        Math.abs(nightlySwap({ ...long, side: 'SELL' }, thu)!) < Math.abs(oneNight), true);
}

// ══════════════════════════════════════════════════════════════════
section('account metrics & stop-out');
// ══════════════════════════════════════════════════════════════════
{
    seedMarket();
    const flat = accountMetrics(1000, []);
    check('flat account equity equals balance', flat.equity, 1000);
    check('flat account has no margin', flat.margin, 0);
    check('flat account margin level is not a breach', flat.marginLevel > STOP_OUT_LEVEL, true);

    // One 0.1 lot EUR/USD long, entered 50 pips onside.
    const held = accountMetrics(1000, [
        { symbol: 'EUR/USD', side: 'BUY', volume: 0.1, entryPrice: 1.07000, commission: 0.7 },
    ]);
    check('margin used', held.margin, 53.75, 0.02);
    check('floating P/L', held.floatingPnL, 50 - 0.7, 0.02);
    check('equity = balance + floating', held.equity, 1000 + 50 - 0.7, 0.02);
    check('free margin = equity - margin', held.freeMargin, held.equity - held.margin, 1e-9);
    check('margin level = equity/margin x100', held.marginLevel, (held.equity / held.margin) * 100, 1e-6);

    // A deeply losing position must drive margin level toward stop-out.
    const losing = accountMetrics(600, [
        { symbol: 'EUR/USD', side: 'BUY', volume: 1.0, entryPrice: 1.08000, commission: 7 },
    ]);
    check('losing account margin level below stop-out', losing.marginLevel < STOP_OUT_LEVEL, true);

    // Unpriced positions must be reported, not silently valued at zero.
    const withUnknown = accountMetrics(1000, [
        { symbol: 'ZZZ/QQQ', side: 'BUY', volume: 1.0, entryPrice: 1.0 },
    ]);
    check('unpriced symbol is flagged', withUnknown.unpriced.length, 1);
    check('unpriced position adds no phantom margin', withUnknown.margin, 0);
}

// ══════════════════════════════════════════════════════════════════
section('precision & volume normalisation');
// ══════════════════════════════════════════════════════════════════
{
    // The old feed ran every price through toFixed(4), which flattened forex
    // to whole pips and collapsed micro-cap crypto to zero.
    check('EUR/USD keeps 5 decimals', roundPrice('EUR/USD', 1.075014), 1.07501, 1e-12);
    check('USD/JPY keeps 3 decimals', roundPrice('USD/JPY', 158.50149), 158.501, 1e-12);
    check('SHIB does not round to zero', roundPrice('SHIB/USDT', 0.000018234) > 0, true);
    check('SHIB keeps 8 decimals', roundPrice('SHIB/USDT', 0.000018234), 0.00001823, 1e-12);

    check('volume snaps to 0.01 step', normaliseVolume('EUR/USD', 0.117), 0.12, 1e-9);
    check('volume clamps to minimum', normaliseVolume('EUR/USD', 0.001), 0.01, 1e-9);
    check('volume clamps to maximum', normaliseVolume('EUR/USD', 5000), 100, 1e-9);
    check('index volume uses 0.1 step', normaliseVolume('SPX', 0.44), 0.4, 1e-9);
}

// ── report ────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(64)}`);
if (failures.length === 0) {
    console.log(`✅ all ${passed} assertions passed`);
    process.exit(0);
} else {
    console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}\n`));
    process.exit(1);
}
