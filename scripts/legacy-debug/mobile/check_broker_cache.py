with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ToolsHubScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'cached_brokers' in line.lower() or 'getItemAsync' in line or 'setItemAsync' in line:
            if 'broker' in line.lower():
                print(f"{i+1}: {line.strip()[:120]}")
