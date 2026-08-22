import os

with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\PositionsScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'socket.on' in line or 'socket' in line:
            if i > 300 and i < 480:
                print(f"{i+1}: {line.strip()}")
