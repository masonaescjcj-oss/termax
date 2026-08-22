import os

screens_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens"
for f in os.listdir(screens_dir):
    if f.endswith('.tsx') or f.endswith('.jsx'):
        path = os.path.join(screens_dir, f)
        print(f"=== {f} ===")
        with open(path, 'r', encoding='utf-8', errors='ignore') as file:
            lines = file.readlines()
            for i, line in enumerate(lines):
                if 'safearea' in line.lower() or 'gettgsafeareatop' in line.lower():
                    print(f"  {i+1}: {line.strip()[:120]}")
