with open(r'C:\t\src\screens\LoginScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'renderDevHub' in line:
        print(f"{i+1}: {line.strip()}")
