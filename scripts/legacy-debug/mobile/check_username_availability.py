with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\LoginScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'usernameAvailable' in line or 'username' in line.lower() and 'check' in line.lower() or 'available' in line.lower():
            print(f"{i+1}: {line.strip()}")
