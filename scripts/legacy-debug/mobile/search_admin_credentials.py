import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend'):
    for file in files:
        if file.endswith(('.ts', '.js', '.json', '.sql', '.env')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'admin@' in content or 'admin_user' in content or 'role: \'admin\'' in content or 'role: "admin"' in content:
                        print(f"File: {path}")
                        for i, line in enumerate(content.splitlines()):
                            if 'admin' in line or 'pass' in line or 'role' in line or 'email' in line:
                                print(f"  {i+1}: {line.strip()}")
            except Exception:
                pass
