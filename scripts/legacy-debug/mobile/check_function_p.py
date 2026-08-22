with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ToolsHubScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'const P =' in line or 'function P(' in line or 'let P =' in line or 'var P =' in line:
            print(f"{i+1}: {line.strip()[:100]}")
