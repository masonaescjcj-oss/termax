import os

base_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src"
for root, dirs, files in os.walk(base_dir):
    for f in files:
        if f.endswith('.ts'):
            path = os.path.join(root, f)
            try:
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
                    if 'Portfolio' in content or 'Snapshot' in content or 'Free Margin' in content or 'active_positions' in content:
                        print(f"FOUND in {path}")
            except Exception as e:
                pass
