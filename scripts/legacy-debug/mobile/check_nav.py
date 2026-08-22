import os
import re

with open(r'C:\t\App.tsx', 'r', encoding='utf-8') as f:
    print("=== App.tsx navigation ===")
    for line in f.readlines():
        if 'Screen' in line or 'Tab' in line or 'Navigator' in line:
            print(line.strip())
