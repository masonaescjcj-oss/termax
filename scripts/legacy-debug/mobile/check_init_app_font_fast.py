import os

base_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src"
for root, dirs, files in os.walk(base_dir):
    if 'node_modules' in dirs:
        dirs.remove('node_modules')
    for f in files:
        if f.endswith('.tsx') or f.endswith('.jsx') or f.endswith('.ts') or f.endswith('.js'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
                if 'initAppFont' in content:
                    print(f"FOUND initAppFont: {path}")
                if 'fontManager' in content:
                    print(f"FOUND fontManager: {path}")
