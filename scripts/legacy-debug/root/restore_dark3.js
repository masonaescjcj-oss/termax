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
    
    // First, fix any backgroundColor that got wrongly set to rgba(11, 15, 26, 1) to colors.background or #0B0F1A
    // Then fix color that got set to rgba(11, 15, 26, 1) back to #F8FAFC
    
    content = content.replace(/backgroundColor:\s*'rgba\(11, 15, 26, 1\)'/g, "backgroundColor: '#0B0F1A'");
    content = content.replace(/rgba\(11, 15, 26, 1\)/g, '#F8FAFC');
    
    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log('Fixed text colors in: ' + file);
    }
});
