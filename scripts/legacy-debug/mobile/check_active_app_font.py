import os

for root, dirs, files in os.walk(r'C:\t'):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.jsx', '.js')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                if 'activeAppFont' in content:
                    print(f"Match: {path}")
