import os
import re

src_dir = r'C:\t\src'
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.jsx') or file.endswith('.js') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                if 'Discover' in content or 'My Groups' in content or 'No groups' in content:
                    print(f"Found match in: {path}")
