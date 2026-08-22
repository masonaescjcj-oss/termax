with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\PositionsScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'Plus' in line or 'Refresh' in line or 'RotateCw' in line or 'refresh' in line:
            print(f"{i+1}: {line.strip()[:100]}")
