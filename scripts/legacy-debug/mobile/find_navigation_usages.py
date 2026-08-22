import os

mobile_src = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile"
for root, dirs, files in os.walk(mobile_src):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.jsx') or f.endswith('.ts') or f.endswith('.js'):
            path = os.path.join(root, f)
            if 'App' in f or 'navigation' in root or 'routes' in root:
                try:
                    with open(path, 'r', encoding='utf-8') as file:
                        content = file.read()
                        if 'ChatScreen' in content:
                            print(f"FOUND navigation usage: {path}")
                except Exception as e:
                    pass
