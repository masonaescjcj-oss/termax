import os

brain_dir = r"C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d"
for root, dirs, files in os.walk(brain_dir):
    for f in files:
        if f.endswith('.md') or f.endswith('.json') or f.endswith('.py') or f.endswith('.js'):
            path = os.path.join(root, f)
            try:
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
                    if 'expo export' in content or 'npx expo' in content or 'npx webpack' in content:
                        print(f"FOUND in {path}")
            except Exception as e:
                pass
print("Done searching expo build commands.")
