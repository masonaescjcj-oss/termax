from PIL import Image, ImageOps
import os

# 1. Load the clean upright app-logo.png
logo_path = r'C:\t\assets\app-logo.png'
logo = Image.open(logo_path).convert('RGBA')

# Create 1024x1024 main icon (black background, centered logo)
icon_size = 1024
main_icon = Image.new('RGBA', (icon_size, icon_size), (0, 0, 0, 255))

# Resize logo to fit nicely inside (e.g. 600px width)
target_w = 600
aspect = logo.height / logo.width
target_h = int(target_w * aspect)
logo_resized = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)

# Paste centered
pos_x = (icon_size - target_w) // 2
pos_y = (icon_size - target_h) // 2
main_icon.paste(logo_resized, (pos_x, pos_y), logo_resized)

# Save main icon.png
main_icon.save(r'C:\t\assets\icon.png', 'PNG')
print("Saved C:\\t\\assets\\icon.png")

# Create adaptive-icon.png (foreground image on transparent or black, for Android adaptive icon)
# Android adaptive icons recommend 1084x1084 with logo inside 66% safe zone (center 720px)
adaptive_size = 1024
adaptive_icon = Image.new('RGBA', (adaptive_size, adaptive_size), (0, 0, 0, 0))
adaptive_target_w = 500
adaptive_target_h = int(adaptive_target_w * aspect)
logo_adaptive = logo.resize((adaptive_target_w, adaptive_target_h), Image.Resampling.LANCZOS)
ad_pos_x = (adaptive_size - adaptive_target_w) // 2
ad_pos_y = (adaptive_size - adaptive_target_h) // 2
adaptive_icon.paste(logo_adaptive, (ad_pos_x, ad_pos_y), logo_adaptive)
adaptive_icon.save(r'C:\t\assets\adaptive-icon.png', 'PNG')
print("Saved C:\\t\\assets\\adaptive-icon.png")

# Now let's update all mipmap folders in android/app/src/main/res/
mipmap_densities = {
    'mipmap-mdpi': (48, 108),
    'mipmap-hdpi': (72, 162),
    'mipmap-xhdpi': (96, 216),
    'mipmap-xxhdpi': (144, 324),
    'mipmap-xxxhdpi': (192, 432),
}

res_base = r'C:\t\android\app\src\main\res'

for folder, (ic_size, fg_size) in mipmap_densities.items():
    folder_path = os.path.join(res_base, folder)
    os.makedirs(folder_path, exist_ok=True)
    
    # 1. ic_launcher.webp (Full square icon with black bg)
    ic_img = main_icon.resize((ic_size, ic_size), Image.Resampling.LANCZOS)
    ic_img.save(os.path.join(folder_path, 'ic_launcher.webp'), 'WEBP')
    ic_img.save(os.path.join(folder_path, 'ic_launcher_round.webp'), 'WEBP')
    
    # 2. ic_launcher_foreground.webp (Foreground logo for adaptive icon)
    fg_img = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
    fg_logo_w = int(fg_size * 0.5)
    fg_logo_h = int(fg_logo_w * aspect)
    fg_logo_res = logo.resize((fg_logo_w, fg_logo_h), Image.Resampling.LANCZOS)
    fg_pos_x = (fg_size - fg_logo_w) // 2
    fg_pos_y = (fg_size - fg_logo_h) // 2
    fg_img.paste(fg_logo_res, (fg_pos_x, fg_pos_y), fg_logo_res)
    fg_img.save(os.path.join(folder_path, 'ic_launcher_foreground.webp'), 'WEBP')

print("Successfully updated all Android native mipmap launcher icons!")
