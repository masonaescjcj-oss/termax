with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\server.ts', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'static' in line or 'uploads' in line or 'express.static' in line:
            print(f"{i+1}: {line.strip()[:100]}")
