with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\AICoachScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'inputContainer' in line or 'styles.input' in line or 'TextInput' in line or 'inputStyle' in line:
            print(f"{i+1}: {line.strip()}")
