import os

def search_files(directory, query):
    for root, dirs, files in os.walk(directory):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        for file in files:
            if file.endswith(('.tsx', '.jsx', '.ts', '.js')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        for i, line in enumerate(f):
                            if query in line:
                                print(f"{path}:{i+1}: {line.strip()[:120]}")
                except Exception:
                    pass

search_files(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile', 'Live Chat')
