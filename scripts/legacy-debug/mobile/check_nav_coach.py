with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\navigation\RootNavigator.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'AICoach' in line or 'Coach' in line:
            print(f"{i+1}: {line.strip()}")
