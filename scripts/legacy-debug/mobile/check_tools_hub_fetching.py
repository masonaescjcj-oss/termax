with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ToolsHubScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'fetch' in line.lower() or 'api/v1/brokers' in line.lower() or 'map' in line.lower():
            if 'brokers' in line.lower():
                print(f"{i+1}: {line.strip()[:120]}")
