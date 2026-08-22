import os

base_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade"
for root, dirs, files in os.walk(base_dir):
    for f in files:
        if 'vercel' in f.lower():
            print(f"Found vercel file: {os.path.join(root, f)}")
