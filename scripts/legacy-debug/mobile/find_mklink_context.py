import os

path = r'C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d\.system_generated\logs\transcript.jsonl'
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            if 'mklink' in line:
                idx = line.find('mklink')
                start = max(0, idx - 150)
                end = min(len(line), idx + 250)
                snippet = line[start:end].encode('ascii', errors='ignore').decode('ascii')
                print(f"Match: ... {snippet} ...")
else:
    print("Transcript not found")
