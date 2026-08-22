with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\LoginScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'const handleLogin' in line or 'const handleRegister' in line or 'login = async' in line or 'register = async' in line or 'auth = async' in line or 'submit' in line:
            print(f"{i+1}: {line.strip()}")
