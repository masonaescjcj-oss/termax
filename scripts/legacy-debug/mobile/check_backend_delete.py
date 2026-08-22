import os

backend_dir = r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend'
if os.path.exists(backend_dir):
    for root, dirs, files in os.walk(backend_dir):
        for file in files:
            if file.endswith(('.ts', '.js')):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if 'deactivate' in content.lower() or 'delete' in content.lower():
                        print(f"Match: {path}")
else:
    print("Backend dir not found")
