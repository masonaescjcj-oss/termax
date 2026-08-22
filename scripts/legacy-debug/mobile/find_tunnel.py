import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)'):
    for file in files:
        if file.endswith(('.ts', '.js', '.json', '.sh', '.bat', '.py', '.txt')):
            path = os.path.join(root, file)
            if 'node_modules' in path or '.git' in path or '.agents' in path:
                continue
            try:
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if 'trycloudflare' in content or 'cloudflared' in content or 'tunnel' in content:
                        print(f"Match: {path}")
            except Exception:
                pass
