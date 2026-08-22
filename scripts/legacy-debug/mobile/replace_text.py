import os
import re

def process_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'from \'react-native\'' not in content: return False
    
    import_match = re.search(r'import\s+\{([^}]*)\}\s+from\s+[\'"]react-native[\'"]', content)
    if not import_match: return False
    
    imported = import_match.group(1)
    has_text = 'Text' in imported.replace('TextInput', '') or 'Text,' in imported or imported.endswith('Text') or imported.startswith('Text')
    has_textinput = 'TextInput' in imported
    
    if not (has_text or has_textinput): return False

    new_imported = re.sub(r'\b(Text|TextInput)\b\s*,?\s*', '', imported).strip()
    if new_imported.endswith(','): new_imported = new_imported[:-1].strip()

    if new_imported:
        new_import_stmt = f"import {{ {new_imported} }} from 'react-native';"
    else:
        new_import_stmt = ''

    # Build typography import
    parts = path.replace('\\', '/').split('/src/')
    if len(parts) > 1:
        depth = parts[1].count('/')
        prefix = '../' * depth if depth > 0 else './'
        if depth == 0 and not parts[1].startswith('components/'): prefix = './components/'
        elif depth > 0: prefix += 'components/'
    else:
        # App.tsx is at root
        prefix = './src/components/'
        
    typography_import = f"import {{ Text{', TextInput' if has_textinput else ''} }} from '{prefix}Typography';\n"
    
    # Replace in file
    content = content[:import_match.start()] + (new_import_stmt + '\n' + typography_import if new_import_stmt else typography_import) + content[import_match.end():]
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Updated', path)
    return True

count = 0
for root, dirs, files in os.walk('C:\\t\\src'):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            path = os.path.join(root, f)
            if process_file(path): count += 1

process_file('C:\\t\\App.tsx')
print('Modified files:', count)
