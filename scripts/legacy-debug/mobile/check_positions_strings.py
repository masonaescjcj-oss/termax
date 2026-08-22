with open(r'C:\t\src\screens\PositionsScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'History' in line or 'Positions' in line or 'renderHeader' in line:
            if 'import' not in line and 'case' not in line:
                print(f"{i+1}: {line.strip()}")
