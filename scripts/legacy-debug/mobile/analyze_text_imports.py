import os
import re

print("Searching for imports of Text in src...")
for root, dirs, files in os.walk(r'C:\t\src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                # Check how Text is imported in this file
                import_rn = re.search(r'import\s+\{[^}]*\bText\b[^}]*\}\s+from\s+[\'"]react-native[\'"]', content)
                import_ty = re.search(r'import\s+\{[^}]*\bText\b[^}]*\}\s+from\s+[\'"].*Typography[\'"]', content)
                
                if import_rn:
                    print(f"[REACT-NATIVE] {path}")
                elif not import_ty and '<Text' in content:
                    print(f"[NO TYPOGRAPHY IMPORT BUT USES <Text>] {path}")
