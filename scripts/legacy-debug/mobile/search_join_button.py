with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ChatScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'JOIN GROUP' in line or 'joinGroup' in line or 'isJoined' in line or 'isMember' in line:
            print(f"{i+1}: {line.strip()[:100]}")
