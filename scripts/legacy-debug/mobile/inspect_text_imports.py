import os
import re

src_dir = r'C:\t\src'
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.tsx', '.jsx', '.js', '.ts')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                if '<Text' in content:
                    # Find all import lines for Text
                    lines = content.splitlines()
                    for line in lines[:30]:
                        if 'Text' in line or 'Typography' in line:
                            print(f"{file:25s} -> {line.strip()}")
