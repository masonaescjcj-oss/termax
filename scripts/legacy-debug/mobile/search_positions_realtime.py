with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\PositionsScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'socket.on(' in line or 'priceUpdate' in line or 'price' in line.lower() or 'pnl' in line.lower():
            if 'style' not in line:
                print(f"{i+1}: {line.strip()[:100]}")
