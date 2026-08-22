const fs = require('fs');
const file = 'c:/Users/Administrator/Desktop/trade/mobile/src/screens/WatchlistScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\}\);\r?\n, logoColor: colors\.success \},/g;
const match = regex.exec(content);

if (match) {
    content = content.substring(0, match.index + 4);
    fs.writeFileSync(file, content);
    console.log("Truncated file successfully.");
} else {
    console.log("Could not find the garbage cutoff.");
}
