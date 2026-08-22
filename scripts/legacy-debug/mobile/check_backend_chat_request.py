import os

path = r'C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d\.system_generated\tasks\task-13811.log'
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
        print("Last 100 lines of Backend log:")
        for line in lines[-100:]:
            if 'chat' in line or 'ai' in line or 'Error' in line or 'POST' in line:
                print(line.strip())
else:
    print("Log not found")
