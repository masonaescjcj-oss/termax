import os
import json

log_path = r'C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d\.system_generated\logs\transcript.jsonl'

if os.path.exists(log_path):
    print("Reading log:")
    with open(log_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                if 'tool_calls' in data:
                    for call in data['tool_calls']:
                        if call.get('name') == 'run_command':
                            cmd = call['arguments'].get('CommandLine', '')
                            if any(x in cmd.lower() for x in ['tunnel', 'cloudflared', 'start', 'dev', 'run', 'npm', 'expo']):
                                print(f"Command: {cmd}")
            except Exception as e:
                pass
else:
    print("Log not found at:", log_path)
