from PIL import Image
import os

images = [
    r'C:\t\assets\app-logo.png',
    r'C:\t\assets\icon.png',
    r'C:\t\assets\adaptive-icon.png'
]

for img_path in images:
    if os.path.exists(img_path):
        with Image.open(img_path) as im:
            print(f"{img_path}: size={im.size}, mode={im.mode}, format={im.format}")
    else:
        print(f"{img_path}: DOES NOT EXIST")
