import os

app_path = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\App.tsx"
if os.path.exists(app_path):
    print("App.tsx exists!")
    with open(app_path, 'r', encoding='utf-8', errors='ignore') as file:
        content = file.read()
        if 'initAppFont' in content:
            print("FOUND initAppFont in App.tsx")
        if 'font' in content.lower():
            print("FOUND font references in App.tsx:")
            for line in content.splitlines():
                if 'font' in line.lower() or 'load' in line.lower():
                    print("  ", line.strip())
