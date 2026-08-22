with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ToolsHubScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'find broker' in line.lower() or 'broker details' in line.lower() or 'vantage' in line.lower() or 'all brokers' in line.lower():
            print(f"{i+1}: {line.strip()}")
