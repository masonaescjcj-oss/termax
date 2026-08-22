with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ToolsHubScreen.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i in range(1100, 1180):
        if i < len(lines):
            print(f"{i+1}: {lines[i].strip().encode('ascii', 'ignore').decode('ascii')}")
