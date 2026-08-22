import os

screens_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens"
for root, dirs, files in os.walk(screens_dir):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.jsx'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
                if 'KeyboardAvoidingView' in content:
                    print(f"=== {f} ===")
                    for i, line in enumerate(content.splitlines()):
                        if 'KeyboardAvoidingView' in line or 'behavior=' in line:
                            print(f"  {i+1}: {line.strip()[:120]}")
