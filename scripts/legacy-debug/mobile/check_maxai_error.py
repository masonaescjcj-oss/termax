import sys
if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d\.system_generated\tasks\task-15213.log', 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        if 'MaxAI Controller Error' in line:
            print(line.strip())
