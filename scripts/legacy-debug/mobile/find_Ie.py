with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ToolsHubScreen.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'const [Ie' in line or 'Ie =' in line or 'useState' in line and 'Ie' in line:
        print(f'{i+1}: {line.strip()}')
