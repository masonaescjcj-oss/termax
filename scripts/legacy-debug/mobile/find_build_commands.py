import os

path = r'C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d\.system_generated\logs\transcript.jsonl'
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            if 'assembleRelease' in line or 'gradlew' in line or 'eas build' in line or 'build' in line:
                if 'CommandLine' in line:
                    print(line.strip()[:300])
else:
    print("Transcript not found")
