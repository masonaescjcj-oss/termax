import os

fonts_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\assets\fonts"
if os.path.exists(fonts_dir):
    print("Fonts directory exists! Files in fonts_dir:")
    for f in os.listdir(fonts_dir):
        if f.endswith('.ttf') or f.endswith('.otf'):
            print("  ", f)
else:
    print("Fonts directory does NOT exist!")
