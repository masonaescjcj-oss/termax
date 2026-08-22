const fs = require('fs');
const content = fs.readFileSync('c:/Users/Administrator/Desktop/trade/mobile/src/screens/WatchlistScreen.tsx', 'utf8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes('    return ('));
const endIndex = lines.findIndex(l => l.startsWith('const styles = StyleSheet.create'));

let jsxLines = lines.slice(startIndex, endIndex);
console.log(jsxLines.join('\n'));
