import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\dist'):
    for file in files:
        if file.endswith(('.js', '.hbc')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if 'trycloudflare.com' in content:
                        print(f"Found in: {path}")
            except Exception:
                pass
