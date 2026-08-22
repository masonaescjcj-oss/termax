with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ChartScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'loading' in line.lower() or 'select' in line.lower() or 'top' in line.lower() or 'safe' in line.lower() or 'header' in line.lower():
        print(f'{i+1}: {line.strip().encode("ascii", "ignore").decode("ascii")}')
