import sys
if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\bot.ts', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'ورود' in line or 'دستور' in line or 'start' in line:
            print(f"{i+1}: {line.strip()[:100]}")
