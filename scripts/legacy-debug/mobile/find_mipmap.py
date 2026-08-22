import os

for root, dirs, files in os.walk(r'C:\t\android\app\src\main\res'):
    if 'mipmap' in root:
        for file in files:
            print(os.path.join(root, file))
