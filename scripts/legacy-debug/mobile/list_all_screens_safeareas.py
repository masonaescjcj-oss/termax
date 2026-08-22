import os

screens_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens"
for f in os.listdir(screens_dir):
    if f.endswith('.tsx') or f.endswith('.jsx'):
        path = os.path.join(screens_dir, f)
        with open(path, 'r', encoding='utf-8', errors='ignore') as file:
            content = file.read()
            has_safe = 'safearea' in content.lower()
            has_tg_safe = 'gettgsafeareatop' in content.lower()
            print(f"File: {f:25} | has_safe: {str(has_safe):5} | has_tg_safe: {str(has_tg_safe):5}")
