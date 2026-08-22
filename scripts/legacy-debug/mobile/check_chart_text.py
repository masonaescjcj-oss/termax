import os
import re

with open(r'C:\t\src\screens\ChartScreen.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Check text components in ChartScreen
matches = re.findall(r'<Text[^>]*>', content)
print(f"ChartScreen has {len(matches)} <Text> components.")
print("Sample Text usages in ChartScreen:")
for m in matches[:10]:
    print(m)
