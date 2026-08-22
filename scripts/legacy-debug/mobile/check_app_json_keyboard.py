import json
import os

app_json_path = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\app.json"
if os.path.exists(app_json_path):
    with open(app_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        print(json.dumps(data.get('expo', {}).get('android', {}), indent=2))
        print("softwareKeyboardLayoutMode:", data.get('expo', {}).get('android', {}).get('softwareKeyboardLayoutMode'))
