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
    
    // Reverse the Light Mode hacks
    content = content.replace(/tint="light"/g, 'tint="dark"');
    content = content.replace(/rgba\(0,0,0,0\.0/g, 'rgba(255,255,255,0.0');
    content = content.replace(/rgba\(0,0,0,0\.1/g, 'rgba(255,255,255,0.1');
    content = content.replace(/#0F172A/g, '#FFF');
    content = content.replace(/#475569/g, '#94A3B8');
    content = content.replace(/rgba\(241,245,249,0\.8\)/g, 'rgba(30,41,59,0.8)');
    content = content.replace(/rgba\(255,255,255,0\.95\)/g, 'rgba(18,22,31,0.95)');
    content = content.replace(/rgba\(255,255,255,0\.85\)/g, 'rgba(18,22,31,0.85)');
    content = content.replace(/rgba\(255,255,255,0\.7\)/g, 'rgba(18,22,31,0.7)');
    
    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log('Updated: ' + file);
    }
});
