const fs = require('fs');
const parser = require('./mobile/node_modules/@babel/parser');

const content = fs.readFileSync('c:/Users/asiac/OneDrive/Desktop/trade (2)/trade/mobile/src/screens/WatchlistScreen.tsx', 'utf8');

try {
    parser.parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
    });
    console.log("No syntax errors found by Babel!");
} catch (err) {
    console.error("Babel Syntax Error:");
    console.error(err.message);
    console.error(`At line ${err.loc.line}, column ${err.loc.column}`);
    
    // Print context
    const lines = content.split('\n');
    const start = Math.max(0, err.loc.line - 5);
    const end = Math.min(lines.length, err.loc.line + 5);
    for (let i = start; i < end; i++) {
        const marker = (i + 1 === err.loc.line) ? ' > ' : '   ';
        console.error(`${marker}${i + 1}: ${lines[i]}`);
    }
}
