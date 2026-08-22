import os
import re

rn_text_files = []
for root, dirs, files in os.walk(r'C:\t'):
    if 'node_modules' in root or '.expo' in root or 'android' in root:
        continue
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                match = re.search(r'import\s+\{([^}]*)\}\s+from\s+[\'"]react-native[\'"]', content)
                if match:
                    imports = [i.strip() for i in match.group(1).split(',')]
                    if 'Text' in imports or 'TextInput' in imports:
                        rn_text_files.append(path)

print(f'Found {len(rn_text_files)} files importing Text/TextInput directly from react-native across whole project:')
for p in rn_text_files:
    print(p)
