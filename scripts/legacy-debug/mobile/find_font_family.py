import os
import re

ff_files = []
for root, dirs, files in os.walk(r'C:\t\src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                matches = re.findall(r'fontFamily:\s*[\'"`]([^\'"`]+)[\'"`]', content)
                if matches:
                    ff_files.append((path, matches))

print(f'Found {len(ff_files)} files with hardcoded fontFamily in src:')
for p, m in ff_files:
    print(p, m)
