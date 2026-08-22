const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function test() {
    try {
        console.log('Fetching...');
        const result = await yahooFinance.chart('XAUUSD=X', { period1: '2026-01-23', interval: '60m' });
        console.log('Chart API Quotes length:', result.quotes.length);
        console.log('Sample Quote:', result.quotes[0]);
    } catch (e) {
        console.log('Error:', e.message);
    }
}
test();
