with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ToolsHubScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'useState' in line and ('he' in line or 'fe' in line):
            print(f"{i+1}: {line.strip()[:100]}")
        elif 'he(' in line or 'he =' in line:
            print(f"{i+1}: {line.strip()[:100]}")
