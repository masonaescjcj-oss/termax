with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\controllers\tradeController.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'margin' in line.lower() or 'pnl' in line.lower() or 'unrealized' in line.lower() or 'equity' in line.lower():
        print(f'{i+1}: {line.strip().encode("ascii", "ignore").decode("ascii")}')
