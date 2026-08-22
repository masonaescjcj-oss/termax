import os

base_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile"
for root, dirs, files in os.walk(base_dir):
    for f in files:
        if f == 'config.ts' or (f == 'index.ts' and os.path.basename(root) == 'config'):
            print(f"Found config file: {os.path.join(root, f)}")
