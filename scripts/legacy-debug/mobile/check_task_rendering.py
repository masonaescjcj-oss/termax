with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\EarnNftScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'task' in line.lower() and 'render' in line.lower() or 'taskType' in line or 'VISIT_LINK' in line:
            print(f"{i+1}: {line.strip()}")
