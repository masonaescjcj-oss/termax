import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend'):
    for file in files:
        if file.endswith(('.ts', '.js')):
            path = os.path.join(root, file)
            if 'node_modules' in path or '.git' in path:
                continue
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'model' in content or 'ai/chat' in content or 'OpenAI' in content or 'Anthropic' in content or 'Gemini' in content or 'DeepSeek' in content or 'nara' in content:
                        if 'src/controllers/ai' in path or 'src/services/ai' in path or 'bot.ts' in path or 'aiController' in path:
                            print(f"File: {path}")
                            for line in content.splitlines():
                                if any(x in line for x in ['model', 'api_key', 'OpenAI', 'Gemini', 'nara', 'DeepSeek', 'process.env']):
                                    print("  ", line.strip())
            except Exception:
                pass
