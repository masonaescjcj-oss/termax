import os

mobile_src = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src"
for root, dirs, files in os.walk(mobile_src):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.jsx') or f.endswith('.ts') or f.endswith('.js'):
            path = os.path.join(root, f)
            try:
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.readlines()
                    for idx, line in enumerate(content):
                        if '<KeyboardAvoidingView' in line:
                            print(f"{f}:{idx+1}: {line.strip()}")
                            # print next 5 lines
                            for j in range(1, 6):
                                if idx + j < len(content):
                                    print(f"   +{j}: {content[idx+j].strip()}")
            except Exception as e:
                pass
