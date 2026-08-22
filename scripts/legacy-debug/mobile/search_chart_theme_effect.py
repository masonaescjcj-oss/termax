with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ChartScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'useEffect' in line or 'isDark' in line or 'toggleTheme' in line or 'changeTheme' in line:
        if i > 1300 and i < 1550:
            print(f'{i+1}: {line.strip().encode("ascii", "ignore").decode("ascii")}')
