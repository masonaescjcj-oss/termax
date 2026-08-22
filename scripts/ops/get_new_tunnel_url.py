import os
import time

path = r'C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d\.system_generated\tasks\task-14468.log'

# Wait up to 15 seconds for the log file to be created and populated
for _ in range(15):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        break
    time.sleep(1)

if os.path.exists(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        print("Log size:", len(content))
        for line in content.splitlines():
            if 'trycloudflare.com' in line:
                print("Tunnel URL Line:", line.strip())
else:
    print("Log not found yet")
