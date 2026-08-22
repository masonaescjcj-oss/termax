import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src'):
    for file in files:
        if file.endswith(('.ts', '.js')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    for i, line in enumerate(f):
                        if 'broker not found' in line.lower():
                            print(f"{path}:{i+1}: {line.strip()}")
            except Exception:
                pass
