import os

for root, dirs, files in os.walk(r'C:\t\assets'):
    for file in files:
        print(os.path.join(root, file))
