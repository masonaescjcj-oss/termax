with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\LoginScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 'Connect Broker' in line or 'cTrader' in line or 'Profile & Settings' in line:
            clean_line = line.strip().encode('ascii', 'ignore').decode('ascii')
            print(f"{i+1}: {clean_line}")
