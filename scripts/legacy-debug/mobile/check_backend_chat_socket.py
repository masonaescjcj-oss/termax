import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend'):
    for file in files:
        if file.endswith(('.ts', '.js')):
            path = os.path.join(root, file)
            if 'node_modules' in path or '.git' in path:
                continue
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'sendMessage' in content:
                        print(f"File: {path}")
                        for i, line in enumerate(content.splitlines()):
                            if 'sendMessage' in line or 'emit' in line or 'socket' in line:
                                if any(x in line for x in ['newMessage', 'room', 'token', 'text', 'save']):
                                    print(f"  {i+1}: {line.strip()}")
            except Exception:
                pass
