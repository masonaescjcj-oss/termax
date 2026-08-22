with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\AICoachScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'coach' in line.lower():
            print(f"{i+1}: {line.strip()}")
