with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ToolsHubScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if ',ee]=' in line or ', ee]=' in line or '[ee,' in line or '[ee ,' in line:
            print(f"{i+1}: {line.strip()[:100]}")
