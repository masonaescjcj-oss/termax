with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\LoginScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'Create Account' in line or 'onPress=' in line and 'Register' in line or 'handleRegisterComplete' in line:
            print(f"{i+1}: {line.strip()}")
