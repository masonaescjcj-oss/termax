const fs = require('fs');
const content = fs.readFileSync('c:/Users/Administrator/Desktop/trade/jsx.txt', 'utf8');

const openTagRegex = /<([A-Z][a-zA-Z0-9]*|View|Text|TouchableOpacity|ScrollView|BlurView|LinearGradient|Image|Modal|SectionList|TextInput|Animated\.View)[^>]*(?<!\/)>/g;
const closeTagRegex = /<\/([A-Z][a-zA-Z0-9]*|View|Text|TouchableOpacity|ScrollView|BlurView|LinearGradient|Image|Modal|SectionList|TextInput|Animated\.View)>/g;

let match;
let tags = [];

while ((match = openTagRegex.exec(content)) !== null) {
    tags.push({ type: 'open', name: match[1], index: match.index });
}

while ((match = closeTagRegex.exec(content)) !== null) {
    tags.push({ type: 'close', name: match[1], index: match.index });
}

tags.sort((a, b) => a.index - b.index);

let stack = [];
for (const tag of tags) {
    if (tag.type === 'open') {
        stack.push(tag.name);
    } else {
        if (stack.length === 0) {
            console.log(`Unmatched close tag: ${tag.name} at index ${tag.index}`);
        } else {
            const last = stack.pop();
            if (last !== tag.name) {
                console.log(`Mismatch! Expected </${last}> but found </${tag.name}> at index ${tag.index}`);
                stack.push(last); // keep it to avoid cascading
            }
        }
    }
}

if (stack.length > 0) {
    console.log("Unclosed tags:", stack);
} else {
    console.log("All tags matched perfectly.");
}
