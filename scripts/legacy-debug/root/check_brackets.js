const fs = require('fs');
const content = fs.readFileSync('c:/Users/Administrator/Desktop/trade/mobile/src/screens/WatchlistScreen.tsx', 'utf8');
let openBraces = 0;
let openParens = 0;

for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '{') openBraces++;
    else if (c === '}') openBraces--;
    else if (c === '(') openParens++;
    else if (c === ')') openParens--;
}
console.log(`Open braces: ${openBraces}, Open parens: ${openParens}`);
