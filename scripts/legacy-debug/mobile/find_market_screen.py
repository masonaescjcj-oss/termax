import os

base_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src"
for root, dirs, files in os.walk(base_dir):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.jsx'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
                if 'Watchlist' in content and 'Community' in content and ('tab' in content.lower() or 'segment' in content.lower()):
                    print(f"FOUND Match: {path}")
