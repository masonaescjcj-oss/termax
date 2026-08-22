import os

with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\PositionsScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if any(x in line.lower() for x in ['equity', 'freemargin', 'margin_level', 'unrealizedpnl', 'marginlevel']):
            print(f"{i+1}: {line.strip()}")
