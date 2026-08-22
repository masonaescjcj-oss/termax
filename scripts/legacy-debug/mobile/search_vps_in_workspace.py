import os

workspace_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade"
for root, dirs, files in os.walk(workspace_dir):
    for f in files:
        if f.endswith('.js') or f.endswith('.ts') or f.endswith('.json') or f.endswith('.sh') or f.endswith('.bat') or f.endswith('.txt') or f.endswith('.md'):
            path = os.path.join(root, f)
            try:
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
                    if '202.133.89.91' in content:
                        print(f"FOUND in {path}")
            except Exception as e:
                pass
print("Done searching workspace.")
