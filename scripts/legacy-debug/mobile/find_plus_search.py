with open(r'C:\t\src\screens\WatchlistScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '<Plus' in line or '<Search' in line or 'Search' in line and 'TouchableOpacity' in lines[max(0, i-3)]:
        print(f"{i+1}: {line.strip()}")
        for j in range(max(0, i-5), min(len(lines), i+6)):
            print(f"   {j+1}: {lines[j].strip()}")
        print("-" * 40)
