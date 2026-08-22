for p in [r'C:\t\src\screens\ChatScreen.jsx', r'C:\t\src\screens\ToolsHubScreen.jsx']:
    print(f"=== {p} ===")
    with open(p, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
        for i, line in enumerate(lines[:35]):
            print(f"{i+1}: {line.rstrip()}")
