import os

with open(r'C:\t\src\screens\PositionsScreen.jsx', 'r', encoding='utf-8', errors='ignore') as f:
    print("=== PositionsScreen.jsx first 50 lines ===")
    lines = f.readlines()
    for line in lines[:50]:
        print(line.strip())
