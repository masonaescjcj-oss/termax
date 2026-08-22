import os

path = r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\eas_build_log_decompressed.txt'
if os.path.exists(path):
    print("Decompressed size:", os.path.getsize(path))
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        print("First 500 chars:", content[:500])
        print("Last 500 chars:", content[-500:])
else:
    print("Decompressed not found")
