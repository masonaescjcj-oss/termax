with open(r'C:\t\src\screens\LoginScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'Modal' in line or 'CustomBlurModal' in line:
            print(f"{i+1}: {line.strip()}")
