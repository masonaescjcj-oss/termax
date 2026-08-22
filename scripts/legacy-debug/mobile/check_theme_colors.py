import os

base_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src"
for root, dirs, files in os.walk(base_dir):
    for f in files:
        if 'theme' in root.lower() or 'color' in f.lower():
            path = os.path.join(root, f)
            print(f"FOUND: {path}")
