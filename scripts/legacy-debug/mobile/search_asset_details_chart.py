with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\AssetDetailsScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'WebView' in line or 'webview' in line.lower() or 'chart' in line.lower() or 'html' in line.lower() or 'isDark' in line or 'colors' in line:
        if 'getChartHtml' in line or 'chartHtml' in line or 'useMemo' in line or 'useEffect' in line or 'socket' in line:
            print(f'{i+1}: {line.strip().encode("ascii", "ignore").decode("ascii")}')
