import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src'):
    for file in files:
        if 'LoginScreen' in file or 'login' in file.lower():
            print(os.path.join(root, file))
