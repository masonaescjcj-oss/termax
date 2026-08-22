with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ToolsHubScreen.jsx', 'r', encoding='utf-8') as f:
    count = 0
    for i, line in enumerate(f):
        if 'state' in line.lower() or 'usestate' in line.lower() or 'react.use' in line.lower():
            print(f"{i+1}: {line.strip()[:120]}")
            count += 1
            if count >= 40:
                break
