with open(r'C:\t\src\screens\PositionsScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'GlassToast' in line:
            print(f"{i+1}: {line.strip()}")
