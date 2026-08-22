with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\ChatScreen.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'headerAvatar' in line or 'Briefcase' in line:
            print(f"{i+1}: {line.strip()[:100]}")
