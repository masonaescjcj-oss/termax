import os

art_dir = r"C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d"
for root, dirs, files in os.walk(art_dir):
    for f in files:
        if f.endswith('.md') or f.endswith('.txt'):
            path = os.path.join(root, f)
            try:
                with open(path, 'r', encoding='utf-8', errors='ignore') as file:
                    content = file.read()
                    if 'vercel' in content.lower():
                        print(f"FOUND Match in file: {f}")
                        for line in content.split('\n'):
                            if 'vercel' in line.lower():
                                print(f"  {line.strip()[:100]}")
            except Exception:
                pass
