import os

path = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\dist\.vercel\project.json"
if os.path.exists(path):
    print("dist/.vercel/project.json exists!")
    with open(path, 'r', encoding='utf-8') as f:
        print(f.read())
else:
    print("dist/.vercel/project.json does not exist.")
