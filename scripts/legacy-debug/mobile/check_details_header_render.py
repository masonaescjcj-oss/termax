with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\AssetDetailsScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 'return (' in line or '<SafeAreaView' in line or 'styles.header' in line or 'styles.safeArea' in line:
            print(f"{i+1}: {line.strip().encode('ascii', 'ignore').decode('ascii')}")
