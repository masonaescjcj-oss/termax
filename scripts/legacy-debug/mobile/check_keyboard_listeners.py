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
            for i, line in enumerate(content.splitlines()):
                if 'keyboard' in line.lower() or 'addlistener' in line.lower():
                    print(f"  {i+1}: {line.strip()[:100]}")
