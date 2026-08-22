const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const admZip = require('adm-zip'); // Note: if adm-zip is not installed, we can write a native stream or install it, or we can just try unzipping. Let's write a script that checks both raw json/tgs (gzip) and .lottie (zip).

const desktopDir = 'C:\\Users\\asiac\\OneDrive\\Desktop\\';

function inspectLottie() {
    try {
        const files = fs.readdirSync(desktopDir);
        const lottieFiles = files.filter(f => f.startsWith('CAACAg') && (f.endsWith('.lottie') || f.endsWith('.json') || f.endsWith('.tgs')));
        
        console.log(`Found ${lottieFiles.length} candidate sticker files.`);
        
        for (const file of lottieFiles) {
            const filePath = path.join(desktopDir, file);
            const stats = fs.statSync(filePath);
            
            // Let's print the file name and size
            console.log(`- File: ${file} (Size: ${stats.size} bytes)`);
            
            if (file.endsWith('.json')) {
                // Read raw JSON
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const json = JSON.parse(content);
                    const layers = (json.layers || []).map(l => l.nm).join(', ');
                    console.log(`  [JSON] Layers: ${layers.substring(0, 150)}...`);
                } catch (e) {
                    console.log(`  [JSON] Failed to parse JSON: ${e.message}`);
                }
            } else if (file.endsWith('.lottie')) {
                // A .lottie file is a zip archive. Let's try reading the animation JSON from it if adm-zip is available.
                // We'll require 'adm-zip' from mobile/node_modules if present.
                try {
                    const AdmZip = require('adm-zip');
                    const zip = new AdmZip(filePath);
                    const zipEntries = zip.getEntries();
                    const entryNames = zipEntries.map(e => e.entryName);
                    console.log(`  [.lottie] Zip contents: ${entryNames.join(', ')}`);
                    
                    // Let's find any animation json
                    const animEntry = zipEntries.find(e => e.entryName.endsWith('.json'));
                    if (animEntry) {
                        const content = animEntry.getData().toString('utf8');
                        const json = JSON.parse(content);
                        const layers = (json.layers || []).map(l => l.nm).join(', ');
                        console.log(`  [.lottie] Layers: ${layers.substring(0, 150)}...`);
                    }
                } catch (e) {
                    console.log(`  [.lottie] Failed to parse zip: ${e.message}`);
                }
            } else if (file.endsWith('.tgs')) {
                // A .tgs file is gzipped JSON
                try {
                    const content = fs.readFileSync(filePath);
                    const decompressed = zlib.gunzipSync(content);
                    const json = JSON.parse(decompressed.toString('utf8'));
                    const layers = (json.layers || []).map(l => l.nm).join(', ');
                    console.log(`  [TGS] Layers: ${layers.substring(0, 150)}...`);
                } catch (e) {
                    console.log(`  [TGS] Failed to decompress TGS: ${e.message}`);
                }
            }
        }
    } catch (err) {
        console.error('Error listing desktop:', err);
    }
}

inspectLottie();
