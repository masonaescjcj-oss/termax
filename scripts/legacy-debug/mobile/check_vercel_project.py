import os

base_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile"
for root, dirs, files in os.walk(base_dir):
    for d in dirs:
        if d == '.vercel':
            print(f"FOUND VERCEL DIR at: {os.path.join(root, d)}")
    # break after first level to be fast
    break
