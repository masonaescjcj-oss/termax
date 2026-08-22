import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src'):
    for file in files:
        if file.endswith(('.ts', '.js', '.tsx', '.jsx')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'PositionsScreen_clean' in content:
                        print(f"Match: {path}")
            except Exception:
                pass
