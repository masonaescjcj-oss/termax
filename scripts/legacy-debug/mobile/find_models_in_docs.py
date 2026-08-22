with open(r'C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d\.system_generated\steps\13348\content.md', 'r', encoding='utf-8') as f:
    for line in f:
        if 'deepseek' in line.lower() or 'model' in line.lower():
            if 'model' in line or 'name' in line or 'id' in line:
                print(line.strip()[:300])
