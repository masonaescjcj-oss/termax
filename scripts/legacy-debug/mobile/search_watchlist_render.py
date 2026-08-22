with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\WatchlistScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'Login Required' in line or 'userProfile' in line or 'login' in line.lower():
        if i > 1200 and i < 1300:
            print(f'{i+1}: {line.strip().encode("ascii", "ignore").decode("ascii")}')
