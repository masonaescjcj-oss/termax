import os
import json

log_dir = r"C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d\.system_generated\logs"
transcript_path = os.path.join(log_dir, "transcript.jsonl")

if os.path.exists(transcript_path):
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                # Check tool calls or text content
                content = str(data.get('content', ''))
                tool_calls = str(data.get('tool_calls', ''))
                if 'ssh' in content.lower() or 'ssh' in tool_calls.lower() or 'vps' in content.lower() or 'pm2' in content.lower():
                    print(f"STEP {data.get('step_index')}: {content[:100]} | TOOLS: {tool_calls[:150]}")
            except Exception as e:
                pass
else:
    print("Transcript not found")
