import os

base_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src"
for root, dirs, files in os.walk(base_dir):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.jsx') or f.endswith('.ts') or f.endswith('.js'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
                if 'useFonts' in content or 'Font.loadAsync' in content or 'fontFamily' in content:
                    print(f"FOUND Font usage: {path}")
