import os

mobile_src = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens"
for root, dirs, files in os.walk(mobile_src):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.jsx') or f.endswith('.ts') or f.endswith('.js'):
            path = os.path.join(root, f)
            try:
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
                    if 'Live Chat' in content or 'AssetDetails' in content or 'Overview' in content:
                        if 'FlatList' in content or 'ScrollView' in content:
                            print(f"FOUND: {path}")
            except Exception as e:
                pass
print("Done searching.")
