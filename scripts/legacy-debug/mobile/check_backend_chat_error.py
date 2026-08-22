import os

path = r'C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d\.system_generated\tasks\task-13811.log'
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            if 'MaxAI' in line or 'Controller Error' in line:
                print(line.strip())
else:
    print("Log not found")
