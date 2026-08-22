with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ToolsHubScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'logo' in line.lower() or 'image' in line.lower() or 'avatar' in line.lower():
            if 'style' not in line or 'logo' in line.lower():
                print(f"{i+1}: {line.strip()[:100]}")
