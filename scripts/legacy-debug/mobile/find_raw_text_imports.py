import os
import re

src_dir = r'C:\t\src'
raw_rn_text_files = []

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.jsx') or file.endswith('.js') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                # Check if Text is imported directly from react-native
                if re.search(r'import\s+.*?\{[^}]*\bText\b[^}]*\}\s+from\s+[\'"]react-native[\'"]', content):
                    raw_rn_text_files.append(path)

print(f"Found {len(raw_rn_text_files)} files importing Text directly from react-native:")
for p in raw_rn_text_files:
    print(p)
