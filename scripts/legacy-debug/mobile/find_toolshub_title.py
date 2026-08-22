with open(r'C:\t\src\screens\ToolsHubScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'Tools Hub' in line or 'headerTitle' in line or 'headerText' in line:
            print(f"{i+1}: {line.strip()}")
