import os
import sys

# Set standard output encoding to utf-8
sys.stdout.reconfigure(encoding='utf-8')

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend'):
    for file in files:
        if 'tradeController' in file and file.endswith('.ts'):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    print(f"File: {path}")
                    for i, line in enumerate(content.splitlines()):
                        if any(x in line for x in ['positions', 'balance', 'equity', 'freeMargin', 'margin']):
                            print(f"  {i+1}: {line.strip()}")
            except Exception as e:
                print(e)
