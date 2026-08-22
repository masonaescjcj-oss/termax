with open(r'C:\t\src\screens\ToolsHubScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'font' in line.lower() or 'fontFamily' in line:
            print(f"{i+1}: {line.strip()}")
