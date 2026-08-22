import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)'):
    for file in files:
        if file.endswith(('.ts', '.js', '.tsx', '.jsx')):
            path = os.path.join(root, file)
            if 'node_modules' in path or '.git' in path:
                continue
            try:
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if 'getAvatarUri' in content and 'src/screens/ChatScreen.jsx' not in path and 'dist/_expo' not in path:
                        print(f"Found definition/reference in: {path}")
                        for i, line in enumerate(content.splitlines()):
                            if 'getAvatarUri' in line:
                                print(f"  {i+1}: {line.strip()}")
            except Exception:
                pass
