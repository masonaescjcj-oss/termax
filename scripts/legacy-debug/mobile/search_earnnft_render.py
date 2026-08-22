with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\EarnNftScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'loginRequiredCard' in line or 'userProfile' in line or 'isAuthenticated' in line:
        print(f'{i+1}: {line.strip().encode("ascii", "ignore").decode("ascii")}')
