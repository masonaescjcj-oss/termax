const WebSocket = require('ws');

console.log('Testing Binance connection...');
const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');

ws.on('open', () => {
    console.log('✅ Connected to Binance!');
    setTimeout(() => { ws.close(); process.exit(0); }, 3000);
});

ws.on('message', (data) => {
    console.log('📩 Received:', data.toString());
});

ws.on('error', (err) => {
    console.log('❌ Binance Error:', err.message);
    process.exit(1);
});

setTimeout(() => {
    console.log('⏱️ Timeout after 5 seconds - Connection probably blocked.');
    ws.close();
    process.exit(1);
}, 5000);
