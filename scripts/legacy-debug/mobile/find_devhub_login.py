with open(r'C:\t\src\screens\LoginScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'dev' in line.lower() or 'hub' in line.lower() or 'font' in line.lower() or 'console' in line.lower():
        print(f"{i+1}: {line.strip()}")
