with open(r'C:\t\src\screens\LoginScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'getAvatarSource' in line or 'const avatars =' in line:
            print(f"{i+1}: {line.strip()}")
