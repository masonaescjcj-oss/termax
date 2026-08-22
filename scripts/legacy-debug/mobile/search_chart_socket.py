with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ChartScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'priceUpdate' in line or 'socket' in line.lower():
            if 'style' not in line:
                print(f"{i+1}: {line.strip()[:120]}")
