import os

base_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)"
for root, dirs, files in os.walk(base_dir):
    for d in dirs:
        if d == '.vercel':
            path = os.path.join(root, d, 'project.json')
            if os.path.exists(path):
                print(f"Path: {path}")
                with open(path, 'r', encoding='utf-8') as f:
                    print(f"Content: {f.read()}")
