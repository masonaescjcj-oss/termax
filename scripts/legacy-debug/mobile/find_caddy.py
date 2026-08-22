import os

for root, dirs, files in os.walk(r'c:\Users\asiac\OneDrive\Desktop\trade (2)'):
    for file in files:
        if 'caddy' in file.lower():
            print(os.path.join(root, file))
