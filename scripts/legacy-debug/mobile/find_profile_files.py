import os

for root, dirs, files in os.walk(r'C:\t\src'):
    for file in files:
        if 'profile' in file.lower() or 'account' in file.lower() or 'setting' in file.lower():
            print(os.path.join(root, file))
