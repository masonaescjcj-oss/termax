with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\AICoachScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'Keyboard.addListener' in line or 'keyboardDidShow' in line or 'keyboardHeight' in line:
            print(f"{i+1}: {line.strip()}")
