import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend'):
    for file in files:
        if 'tradeController' in file or 'tradeRoutes' in file:
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    print(f"File: {path}")
                    for i, line in enumerate(content.splitlines()):
                        if 'positions' in line or 'balance' in line or 'equity' in line or 'freeMargin' in line or 'margin' in line:
                            print(f"  {i+1}: {line.strip()}")
            except Exception as e:
                print(e)
