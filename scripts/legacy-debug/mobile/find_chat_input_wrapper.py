with open(r'C:\t\src\screens\AssetDetailsScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'chatInputWrapper' in line:
            print(f"{i+1}: {line.strip()}")
