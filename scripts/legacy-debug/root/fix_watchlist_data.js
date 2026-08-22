const fs = require('fs');
const file = 'c:/Users/Administrator/Desktop/trade/mobile/src/screens/WatchlistScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const INITIAL_WATCHLIST_DATA = \[[\s\S]*?\];/;
const replacement = `const INITIAL_WATCHLIST_DATA = [
    {
        title: 'Crypto',
        data: [
            { id: '11', symbol: 'BTC/USDT', name: 'Bitcoin', price: '...', change: '...', changePct: '...', logoBadge: '?', logoColor: '#F7931A' },
            { id: '12', symbol: 'ETH/USDT', name: 'Ethereum', price: '...', change: '...', changePct: '...', logoBadge: '?', logoColor: '#627EEA' },
            { id: '13', symbol: 'SOL/USDT', name: 'Solana', price: '...', change: '...', changePct: '...', logoBadge: 'S', logoColor: '#14F195' },
            { id: '14', symbol: 'BNB/USDT', name: 'BNB', price: '...', change: '...', changePct: '...', logoBadge: 'B', logoColor: '#F3BA2F' },
            { id: '15', symbol: 'XRP/USDT', name: 'XRP', price: '...', change: '...', changePct: '...', logoBadge: 'X', logoColor: '#23292F' },
            { id: '16', symbol: 'ADA/USDT', name: 'Cardano', price: '...', change: '...', changePct: '...', logoBadge: 'A', logoColor: '#0033AD' },
            { id: '17', symbol: 'DOGE/USDT', name: 'Dogecoin', price: '...', change: '...', changePct: '...', logoBadge: 'Ð', logoColor: '#C2A633' },
            { id: '18', symbol: 'AVAX/USDT', name: 'Avalanche', price: '...', change: '...', changePct: '...', logoBadge: 'A', logoColor: '#E84142' },
            { id: '19', symbol: 'LINK/USDT', name: 'Chainlink', price: '...', change: '...', changePct: '...', logoBadge: 'L', logoColor: '#2A5ADA' },
            { id: '20', symbol: 'DOT/USDT', name: 'Polkadot', price: '...', change: '...', changePct: '...', logoBadge: 'P', logoColor: '#E6007A' },
            { id: '21', symbol: 'MATIC/USDT', name: 'Polygon', price: '...', change: '...', changePct: '...', logoBadge: 'M', logoColor: '#8247E5' },
            { id: '22', symbol: 'SHIB/USDT', name: 'Shiba Inu', price: '...', change: '...', changePct: '...', logoBadge: 'S', logoColor: '#E1B303' },
            { id: '23', symbol: 'LTC/USDT', name: 'Litecoin', price: '...', change: '...', changePct: '...', logoBadge: 'L', logoColor: '#345D9D' },
            { id: '24', symbol: 'TRX/USDT', name: 'TRON', price: '...', change: '...', changePct: '...', logoBadge: 'T', logoColor: '#FF6431' },
            { id: '25', symbol: 'UNI/USDT', name: 'Uniswap', price: '...', change: '...', changePct: '...', logoBadge: 'U', logoColor: '#FF007A' },
        ]
    },
    {
        title: 'Indices',
        data: [
            { id: '1', symbol: 'SPX', name: 'S&P 500 Index', price: '...', change: '...', changePct: '...', logoBadge: '500', logoColor: colors.logo1 },
            { id: '2', symbol: 'NDQ', name: 'US 100 Index', price: '...', change: '...', changePct: '...', logoBadge: '100', logoColor: colors.logo2 },
            { id: '3', symbol: 'DJI', name: 'Dow Jones Industrial Average Index', price: '...', change: '...', changePct: '...', logoBadge: '30', logoColor: colors.logo2 },
            { id: '4', symbol: 'VIX', name: 'Volatility S&P 500 Index', price: '...', change: '...', changePct: '...', logoBadge: 'V', logoColor: colors.logo3, tag: 'D' },
            { id: '5', symbol: 'DXY', name: 'U.S. Dollar Currency Index', price: '...', change: '...', changePct: '...', logoBadge: '$', logoColor: colors.success },
        ]
    },
    {
        title: 'Stocks',
        data: [
            { id: '6', symbol: 'AAPL', name: 'Apple Inc.', price: '...', change: '...', changePct: '...', logoBadge: 'A', logoColor: colors.border },
            { id: '26', symbol: 'MSFT', name: 'Microsoft Corp.', price: '...', change: '...', changePct: '...', logoBadge: 'M', logoColor: colors.success },
            { id: '27', symbol: 'NVDA', name: 'NVIDIA Corp.', price: '...', change: '...', changePct: '...', logoBadge: 'N', logoColor: colors.success },
            { id: '28', symbol: 'GOOGL', name: 'Alphabet Inc.', price: '...', change: '...', changePct: '...', logoBadge: 'G', logoColor: colors.danger },
            { id: '29', symbol: 'AMZN', name: 'Amazon.com Inc.', price: '...', change: '...', changePct: '...', logoBadge: 'a', logoColor: colors.logo1 },
            { id: '7', symbol: 'TSLA', name: 'Tesla, Inc.', price: '...', change: '...', changePct: '...', logoBadge: 'T', logoColor: colors.danger },
            { id: '8', symbol: 'NFLX', name: 'Netflix, Inc.', price: '...', change: '...', changePct: '...', logoBadge: 'N', logoColor: colors.danger },
        ]
    },
    {
        title: 'Futures',
        data: [
            { id: '9', symbol: 'USOIL', name: 'CFDs on WTI Crude Oil', price: '...', change: '...', changePct: '...', logoBadge: '??', logoColor: '#1A1D24' },
            { id: '10', symbol: 'GOLD', name: 'CFDs on Gold (US$ / OZ)', price: '...', change: '...', changePct: '...', logoBadge: 'Au', logoColor: '#B68925' },
            { id: '30', symbol: 'SILVER', name: 'CFDs on Silver (US$ / OZ)', price: '...', change: '...', changePct: '...', logoBadge: 'Ag', logoColor: '#C0C0C0' },
        ]
    }
];`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
console.log('Fixed INITIAL_WATCHLIST_DATA!');
