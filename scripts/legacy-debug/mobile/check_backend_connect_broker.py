import os

backend_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend"
target_term = "connect-broker"

found = []
for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith(('.ts', '.js')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if target_term in content:
                        found.append(path)
            except Exception as e:
                pass

print("FOUND_FILES:")
for f in found:
    print(f"- {f}")
