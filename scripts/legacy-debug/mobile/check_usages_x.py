import sys
if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ToolsHubScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'X.map' in line or 'X.filter' in line or 'X.find' in line or 'featured' in line.lower() or 'promoted' in line.lower():
            if 'style' not in line or 'X' in line:
                print(f"{i+1}: {line.strip()[:120]}")
