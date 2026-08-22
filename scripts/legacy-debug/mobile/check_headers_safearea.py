import os

files = [
    r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\AICoachScreen.tsx",
    r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\AssetDetailsScreen.tsx",
    r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ChatScreen.jsx"
]

for p in files:
    if os.path.exists(p):
        print(f"=== {os.path.basename(p)} ===")
        with open(p, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            # Look for SafeAreaView, safe-area, or header style
            for line in content.splitlines():
                if 'safearea' in line.lower() or 'safe-area' in line.lower() or 'insets' in line.lower() or 'header:' in line.lower() or 'headerStyle' in line.lower():
                    print("  ", line.strip())
