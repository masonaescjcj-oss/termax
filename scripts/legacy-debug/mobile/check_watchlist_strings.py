import re

with open(r'C:\t\src\screens\WatchlistScreen.tsx', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if any(k in line for k in ['Discover', 'My Groups', 'No groups', 'Watchlist', 'Community']):
        print(f"{i+1}: {line.strip()}")
