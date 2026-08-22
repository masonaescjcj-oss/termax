with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\WatchlistScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 'safe' in line.lower() or 'gettg' in line.lower() or 'header' in line.lower():
            print(f"{i+1}: {line.strip().encode('ascii', 'ignore').decode('ascii')}")
