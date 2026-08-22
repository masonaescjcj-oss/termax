import os
import re

src_dir = r'C:\t\src'
report = []

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.tsx', '.jsx', '.js', '.ts')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                if '<Text' in content:
                    has_typography = 'components/Typography' in content or "components\\Typography" in content or '../components/Typography' in content
                    has_rn_text = bool(re.search(r'import\s+.*?\{[^}]*\bText\b[^}]*\}\s+from\s+[\'"]react-native[\'"]', content))
                    report.append({
                        'file': path,
                        'has_typography': has_typography,
                        'has_rn_text': has_rn_text
                    })

print(f"Total files using <Text: {len(report)}")
print("\n--- Files importing Text from react-native instead of Typography ---")
for r in report:
    if r['has_rn_text']:
        print("BAD:", r['file'])
