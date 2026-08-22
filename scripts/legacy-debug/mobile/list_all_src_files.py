import os

src_dir = r'C:\t\src'
for root, dirs, files in os.walk(src_dir):
    for file in files:
        print(os.path.join(root, file))
