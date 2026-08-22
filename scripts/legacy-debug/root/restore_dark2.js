const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('c:/Users/Administrator/Desktop/trade/mobile/src');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Reverse hardcoded light mode hex codes
    content = content.replace(/#F8FAFC/g, 'rgba(11, 15, 26, 1)'); // Dark background equivalent
    content = content.replace(/#F1F5F9/g, 'rgba(255,255,255,0.05)'); // Dark surface equivalent
    
    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log('Updated HEX colors in: ' + file);
    }
});
