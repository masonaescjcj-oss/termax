with open(r'C:\t\src\screens\AssetDetailsScreen.tsx', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if any(k in line for k in ['avatar', 'Avatar', 'Live Chat', '??', 'header']):
        print(f"{i+1}: {line.strip()}")
