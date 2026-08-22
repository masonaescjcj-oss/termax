with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\controllers\authController.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 'connectBroker' in line or 'connect-broker' in line or 'cTrader' in line or 'accounts' in line or 'Account' in line:
            print(f"{i+1}: {line.strip().encode('ascii', 'ignore').decode('ascii')}")
