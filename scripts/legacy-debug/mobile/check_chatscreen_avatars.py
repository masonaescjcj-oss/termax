with open(r'C:\t\src\screens\ChatScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'avatarUrl' in line or 'avatarUri' in line:
            print(f"{i+1}: {line.strip()}")
