import os
import re

for root, dirs, files in os.walk(r'C:\t'):
    if 'node_modules' in root or '.expo' in root or 'android' in root:
        continue
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                if 'initAppFont' in content:
                    print('Found initAppFont in:', path)
