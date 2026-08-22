import os

for root, dirs, files in os.walk(r'C:\t\android\app\src\main\res'):
    for file in files:
        if file.endswith('.png'):
            print(os.path.join(root, file))
