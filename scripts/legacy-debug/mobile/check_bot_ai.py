with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\bot.ts', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'coach' in line.lower() or 'pikkapi' in line or 'openai' in line.lower() or 'deepseek' in line.lower():
            print(f"{i+1}: {line.strip()}")
