import os

path = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\vercel.json"
if os.path.exists(path):
    print("vercel.json exists!")
    with open(path, 'r', encoding='utf-8') as f:
        print(f.read())
else:
    print("vercel.json does not exist.")
