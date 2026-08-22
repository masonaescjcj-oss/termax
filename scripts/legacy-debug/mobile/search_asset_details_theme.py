with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\AssetDetailsScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'changeAppColors' in line or 'changeTheme' in line or 'colors' in line:
        if 'useEffect' in line or 'sendMessageToChart' in line:
            print(f'{i+1}: {line.strip().encode("ascii", "ignore").decode("ascii")}')
