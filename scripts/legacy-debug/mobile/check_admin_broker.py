with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\controllers\adminController.ts', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'broker' in line.lower() or 'update' in line.lower() or 'put' in line.lower():
            print(f"{i+1}: {line.strip()[:100]}")
