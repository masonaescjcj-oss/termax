import sys
if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d\.system_generated\tasks\task-15943.log', 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        if 'joinCommunity' in line or 'join' in line or 'Error' in line or 'db' in line or 'Auth' in line:
            print(line.strip()[:120])
