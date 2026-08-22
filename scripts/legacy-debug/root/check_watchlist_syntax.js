const fs = require('fs');

const content = fs.readFileSync('c:/Users/asiac/OneDrive/Desktop/trade (2)/trade/mobile/src/screens/WatchlistScreen.tsx', 'utf8');

// Check JSX tags
const openTagRegex = /<(Animated\.View|[A-Z][a-zA-Z0-9]*|View|Text|TouchableOpacity|ScrollView|BlurView|LinearGradient|Image|Modal|SectionList|TextInput)[^>]*(?<!\/)>/g;
const closeTagRegex = /<\/(Animated\.View|[A-Z][a-zA-Z0-9]*|View|Text|TouchableOpacity|ScrollView|BlurView|LinearGradient|Image|Modal|SectionList|TextInput)>/g;

let match;
let tags = [];

while ((match = openTagRegex.exec(content)) !== null) {
    tags.push({ type: 'open', name: match[1], index: match.index, line: content.substring(0, match.index).split('\n').length });
}

while ((match = closeTagRegex.exec(content)) !== null) {
    tags.push({ type: 'close', name: match[1], index: match.index, line: content.substring(0, match.index).split('\n').length });
}

tags.sort((a, b) => a.index - b.index);

let stack = [];
for (const tag of tags) {
    if (tag.type === 'open') {
        stack.push(tag);
    } else {
        if (stack.length === 0) {
            console.log(`Unmatched close tag: </${tag.name}> at line ${tag.line}`);
        } else {
            const last = stack.pop();
            if (last.name !== tag.name) {
                console.log(`Mismatch! Expected </${last.name}> (opened at line ${last.line}) but found </${tag.name}> at line ${tag.line}`);
                stack.push(last); // keep it to avoid cascading
            }
        }
    }
}

if (stack.length > 0) {
    console.log("Unclosed tags:", stack.map(t => `${t.name} (line ${t.line})`));
} else {
    console.log("All JSX tags matched perfectly.");
}

// Check bracket parity (parentheses, square brackets, curly braces)
let brackets = [];
let lineNum = 1;
for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '\n') lineNum++;
    if (char === '(' || char === '[' || char === '{') {
        brackets.push({ char, line: lineNum });
    } else if (char === ')' || char === ']' || char === '}') {
        if (brackets.length === 0) {
            console.log(`Unmatched closing bracket: ${char} at line ${lineNum}`);
        } else {
            const last = brackets.pop();
            const matching = { ')': '(', ']': '[', '}': '{' };
            if (last.char !== matching[char]) {
                console.log(`Mismatch! Expected matching for ${last.char} (from line ${last.line}) but found ${char} at line ${lineNum}`);
                brackets.push(last);
            }
        }
    }
}

if (brackets.length > 0) {
    console.log("Unclosed brackets:", brackets.map(b => `${b.char} (line ${b.line})`));
} else {
    console.log("All brackets matched perfectly.");
}
