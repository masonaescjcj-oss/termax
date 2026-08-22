with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ToolsHubScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'trust score' in line.lower() or 'spreads' in line.lower() or 'reg:' in line.lower():
            print(f"{i+1}: {line.strip()[:120]}")
