with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\LoginScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'ActivityIndicator' in line or 'loading' in line.lower() or 'disabled=' in line:
            print(f"{i+1}: {line.strip()}")
