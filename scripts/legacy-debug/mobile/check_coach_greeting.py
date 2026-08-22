with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\AICoachScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if "Hello! I'm your AI" in line or "Welcome" in line or "AI Trading Coach" in line:
            print(f"{i+1}: {line.strip()}")
