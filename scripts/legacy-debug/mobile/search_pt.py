with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ToolsHubScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'const [pt' in line or 'let pt' in line or ',pt]' in line or 'pt,' in line or 'setPt' in line or 'he(' in line:
            print(f"{i+1}: {line.strip()[:100]}")
