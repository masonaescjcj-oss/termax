with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\controllers\tradeController.ts', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'contractSizes' in line:
            print(f"{i+1}: {line.strip()}")
