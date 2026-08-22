import re

with open(r'C:\t\src\screens\WatchlistScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'search' in line.lower() or 'plus' in line.lower() or 'add' in line.lower() or 'icon' in line.lower() or 'Ionicons' in line or 'Feather' in line:
        if i < 300: # Usually top bar is in first 300 lines
            print(f"{i+1}: {line.strip()}")
