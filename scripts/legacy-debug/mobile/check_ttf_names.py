import os
from PIL import ImageFont

fonts_dir = r'C:\t\assets\fonts'
for f in os.listdir(fonts_dir):
    if f.endswith('.ttf'):
        path = os.path.join(fonts_dir, f)
        try:
            font = ImageFont.truetype(path, 12)
            name = font.getname()
            print(f"{f:25s} -> Family: {name[0]}, Style: {name[1]}")
        except Exception as e:
            print(f"{f:25s} -> ERROR: {e}")
