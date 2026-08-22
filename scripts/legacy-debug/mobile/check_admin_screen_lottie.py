with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\AdminScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'Reward Lottie Key' in line or 'lottie' in line.lower() or 'rocket' in line or 'manage campaign tasks' in line.lower():
            print(f"{i+1}: {line.strip()}")
