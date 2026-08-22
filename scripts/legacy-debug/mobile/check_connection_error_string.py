import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src'):
    for file in files:
        if file.endswith(('.tsx', '.jsx', '.ts', '.js')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'trouble connecting' in content or 'Sorry, I am having' in content:
                        print(f"File: {path}")
                        for i, line in enumerate(content.splitlines()):
                            if 'trouble' in line or 'connecting' in line or 'Sorry' in line:
                                print(f"  {i+1}: {line.strip()}")
            except Exception:
                pass
