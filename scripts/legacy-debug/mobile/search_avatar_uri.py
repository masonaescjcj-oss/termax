import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile'):
    for file in files:
        if file.endswith(('.ts', '.js', '.tsx', '.jsx')):
            path = os.path.join(root, file)
            if 'node_modules' in path or '.git' in path or '.vercel' in path or 'inspect-archive' in path:
                continue
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'getAvatarUri' in content:
                        print(f"Found in: {path}")
            except Exception:
                pass
