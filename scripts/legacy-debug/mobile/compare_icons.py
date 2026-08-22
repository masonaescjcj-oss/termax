from PIL import Image
import numpy as np

def inspect_img(path):
    im = Image.open(path).convert('RGBA')
    arr = np.array(im)
    print(f"--- {path} ---")
    print("Shape:", arr.shape)
    # Check non-transparent bounding box
    alpha = arr[:, :, 3]
    coords = np.argwhere(alpha > 0)
    if len(coords) > 0:
        y_min, x_min = coords.min(axis=0)
        y_max, x_max = coords.max(axis=0)
        print(f"Bounding Box: Y=({y_min}, {y_max}), X=({x_min}, {x_max})")
        print(f"Width={x_max-x_min}, Height={y_max-y_min}")

inspect_img(r'C:\t\assets\app-logo.png')
inspect_img(r'C:\t\assets\icon.png')
inspect_img(r'C:\t\assets\adaptive-icon.png')
