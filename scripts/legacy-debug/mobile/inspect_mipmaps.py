from PIL import Image
import numpy as np

# Load app-logo.png
logo = Image.open(r'C:\t\assets\app-logo.png').convert('RGBA')
icon = Image.open(r'C:\t\assets\icon.png').convert('RGBA')

print("Logo size:", logo.size)
print("Icon size:", icon.size)

# Let's inspect mipmap-xxhdpi/ic_launcher_foreground.webp and ic_launcher.webp
try:
    mipmap_fg = Image.open(r'C:\t\android\app\src\main\res\mipmap-xxhdpi\ic_launcher_foreground.webp').convert('RGBA')
    print("Mipmap FG size:", mipmap_fg.size)
except Exception as e:
    print("Error opening mipmap:", e)
