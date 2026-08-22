import os
import sys

if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

path = r'C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d\.system_generated\tasks\task-14771.log'

if os.path.exists(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
        print("Last 50 lines of backend log:")
        for line in lines[-50:]:
            try:
                print(line.strip())
            except Exception:
                print(line.encode('ascii', 'ignore').decode('ascii'))
else:
    print("Log not found")
