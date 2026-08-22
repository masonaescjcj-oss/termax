import urllib.request
import re
import os
from PIL import ImageFont

missing_fonts = [
    ("PlayfairDisplay", "Playfair+Display"),
    ("PlusJakartaSans", "Plus+Jakarta+Sans"),
    ("WorkSans", "Work+Sans"),
    ("RedHatDisplay", "Red+Hat+Display")
]

dest1 = r'C:\t\assets\fonts'
dest2 = r'C:\t\android\app\src\main\assets\fonts'

for name, api_name in missing_fonts:
    p1 = os.path.join(dest1, f"{name}.ttf")
    p2 = os.path.join(dest2, f"{name}.ttf")
    
    css_url = f"https://fonts.googleapis.com/css2?family={api_name}&display=swap"
    try:
        req = urllib.request.Request(css_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req) as resp:
            css_text = resp.read().decode('utf-8')
            urls = re.findall(r'url\((https://[^)]+)\)', css_text)
            if urls:
                font_url = urls[0]
                req_font = urllib.request.Request(font_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req_font) as f_resp:
                    data = f_resp.read()
                    with open(p1, 'wb') as f1:
                        f1.write(data)
                    with open(p2, 'wb') as f2:
                        f2.write(data)
                    print(f"[FETCHED VIA CSS API] {name}")
    except Exception as e:
        print(f"[API ERROR] {name}: {e}")
