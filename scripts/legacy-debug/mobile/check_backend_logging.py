import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src'):
    for file in files:
        if file.endswith(('.ts', '.js')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'morgan' in content or 'logger' in content or 'app.use(' in content:
                        print(f"File: {path}")
                        for i, line in enumerate(content.splitlines()):
                            if 'morgan' in line or 'logger' in line or 'use(' in line or 'console.log' in line:
                                print(f"  {i+1}: {line.strip()}")
            except Exception:
                pass
