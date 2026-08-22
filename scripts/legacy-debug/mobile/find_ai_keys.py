import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend'):
    for file in files:
        if file.endswith(('.ts', '.js', '.json')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                if 'DEEPSEEK_API_KEY' in content or 'pikkapi' in content or 'aiController' in content:
                    print(f"Match: {path}")
