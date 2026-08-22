const yf1 = require('yahoo-finance2');
console.log('Keys in yf1:', Object.keys(yf1));
if (yf1.default) {
    console.log('yf1.default type:', typeof yf1.default, yf1.default.constructor.name);
}

try {
    const yf2 = require('yahoo-finance2').default;
    yf2.historical('AAPL', { period1: '2023-01-01' }).then(res => console.log('yf2 hit:', res.length)).catch(e => console.log('yf2 err:', e.message));
} catch (e) {
    console.error(e);
}
