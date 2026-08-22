with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\AICoachScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'KeyboardAvoidingView' in line or 'return (' in line or 'behavior=' in line or 'keyboardVerticalOffset' in line:
            print(f"{i+1}: {line.strip()}")
