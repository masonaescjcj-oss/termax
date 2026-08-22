with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\AssetDetailsScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'sendMsgToApp' in line or 'chartReady' in line or 'ready' in line:
        if i < 300:
            print(f'{i+1}: {line.strip().encode("ascii", "ignore").decode("ascii")}')
