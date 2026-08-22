import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src'):
    for file in files:
        if file.endswith(('.tsx', '.jsx', '.ts', '.js')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'Reward Lottie Key' in content or 'Manage Campaign Tasks' in content or 'AdminScreen' in file:
                        print(f"File: {path}")
            except Exception:
                pass
