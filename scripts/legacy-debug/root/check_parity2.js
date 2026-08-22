const fs = require('fs');
const content = fs.readFileSync('c:/Users/Administrator/Desktop/trade/mobile/src/screens/WatchlistScreen.tsx', 'utf8');
const lines = content.split('\n');

let openBraces = 0;
let openParens = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const c = line[j];
        if (c === '{') openBraces++;
        else if (c === '}') openBraces--;
        else if (c === '(') openParens++;
        else if (c === ')') openParens--;
    }
    if (i % 50 === 0) console.log(`Line ${i}: Braces ${openBraces}, Parens ${openParens}`);
}
console.log(`Final -> Braces: ${openBraces}, Parens: ${openParens}`);
