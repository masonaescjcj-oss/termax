with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\AdminScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'activeTab ===' in line and 'map' not in line:
            print(f"{i+1}: {line.strip()[:100]}")
