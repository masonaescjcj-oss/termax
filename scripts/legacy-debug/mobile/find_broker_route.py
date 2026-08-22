import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src'):
    for file in files:
        if file.endswith(('.ts', '.js')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if '/brokers' in content or 'getBrokers' in content or 'brokers' in content:
                        print(f"File: {path}")
            except Exception:
                pass
