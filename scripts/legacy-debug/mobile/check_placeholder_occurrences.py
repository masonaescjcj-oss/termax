with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ToolsHubScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'name[0]' in line or 't.name[0]' in line or 'ie?.name[0]' in line:
            print(f"{i+1}: {line.strip()}")
