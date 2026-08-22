from PIL import Image
import numpy as np

def check_rotation(path):
    img = Image.open(path).convert('RGBA')
    arr = np.array(img)
    # Find white pixels (the 'X' logo)
    r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
    white_mask = (r > 200) & (g > 200) & (b > 200) & (a > 200)
    y_indices, x_indices = np.where(white_mask)
    if len(y_indices) == 0:
        print(f"{path}: No white pixels found")
        return
    y_min, y_max = y_indices.min(), y_indices.max()
    x_min, x_max = x_indices.min(), x_indices.max()
    h = y_max - y_min
    w = x_max - x_min
    print(f"{path}: White logo width={w}, height={h}, ratio(w/h)={w/h:.2f}")

check_rotation(r'C:\t\assets\app-logo.png')
check_rotation(r'C:\t\assets\icon.png')
check_rotation(r'C:\t\assets\adaptive-icon.png')
check_rotation(r'C:\t\android\app\src\main\res\mipmap-xxhdpi\ic_launcher_foreground.webp')
check_rotation(r'C:\t\android\app\src\main\res\mipmap-xxhdpi\ic_launcher.webp')
