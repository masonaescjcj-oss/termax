with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\PositionsScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'accountData' in line or 'equity' in line.lower() or 'margin' in line.lower() or 'balance' in line.lower():
            if 'style' not in line:
                print(f"{i+1}: {line.strip()[:100]}")
