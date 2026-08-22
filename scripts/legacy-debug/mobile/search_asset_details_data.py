with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\AssetDetailsScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'fetch' in line.lower() or 'candles' in line.lower() or 'history' in line.lower() or 'socket' in line.lower():
        print(f'{i+1}: {line.strip().encode("ascii", "ignore").decode("ascii")}')
