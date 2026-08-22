import os

path = r'C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d\.system_generated\tasks\task-14774.log'

if os.path.exists(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        print("Tunnel Log Lines:")
        for line in content.splitlines()[-20:]:
            print(line.strip())
else:
    print("Log not found yet")
