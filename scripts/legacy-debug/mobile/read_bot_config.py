import os
import sys

if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

config_path = r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\bot_config.json'
config_path_root = r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\bot_config.json'

for path in [config_path, config_path_root]:
    if os.path.exists(path):
        print(f"FOUND: {path}")
        with open(path, 'r', encoding='utf-8') as f:
            print(f.read())
    else:
        print(f"NOT_FOUND: {path}")
