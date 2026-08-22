with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\PositionsScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if any(x in line for x in ['account.balance', 'account.equity', 'account.margin', 'account.freeMargin', 'account.marginLevel']):
            print(f"{i+1}: {line.strip()}")
