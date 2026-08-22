import sys
if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

matches = []
with open(r'C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d\.system_generated\tasks\task-14771.log', 'r', encoding='utf-8', errors='ignore') as f:
    for i, line in enumerate(f):
        if 'error' in line.lower() or 'broker' in line.lower() or '404' in line:
            if 'subscribe' not in line.lower() and 'historical' not in line.lower():
                matches.append(f"{i+1}: {line.strip()[:150]}")

for m in matches[-50:]:
    print(m)
