import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src'):
    for file in files:
        if 'RootNavigator' in file or 'navigation' in root.lower() and file.endswith(('.tsx', '.jsx', '.ts', '.js')):
            print(os.path.join(root, file))
