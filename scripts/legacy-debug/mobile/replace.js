const fs = require('fs');
let c = fs.readFileSync('src/screens/ChartScreen.tsx', 'utf8');
c = c.replace(/const formattedData = response\.data\.map\(\(item: any\) => \(\{\s*timestamp: new Date\(item\.timestamp\)\.getTime\(\),\s*open: item\.open, high: item\.high, low: item\.low, close: item\.close, volume: item\.volume \|\| 0\s*\}\)\)\.sort\(\(a: any, b: any\) => a\.timestamp - b\.timestamp\);/, 
`        const getSnapSeconds = (interval: string) => {
          if (interval === '1m') return 60;
          if (interval === '5m') return 300;
          if (interval === '15m') return 900;
          if (interval === '30m') return 1800;
          if (interval === '1h') return 3600;
          if (interval === '4h') return 14400;
          if (interval === '1d') return 86400;
          if (interval === '1w') return 604800;
          return 3600;
        };
        const snapSeconds = getSnapSeconds(selectedInterval);

        const formattedData = response.data.map((item: any) => {
          const currentUnixTime = Math.floor(new Date(item.timestamp).getTime() / 1000);
          const snappedTime = currentUnixTime - (currentUnixTime % snapSeconds);
          return {
            timestamp: snappedTime * 1000,
            open: item.open, high: item.high, low: item.low, close: item.close, volume: item.volume || 0
          };
        }).sort((a: any, b: any) => a.timestamp - b.timestamp);`);
fs.writeFileSync('src/screens/ChartScreen.tsx', c);
