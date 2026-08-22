import urllib.request
import os
from PIL import ImageFont

fix_urls = [
    ("Nunito", "https://fonts.gstatic.com/s/nunito/v26/XRXV3I6Li01BKofINeaBTMnFcQ.ttf"),
    ("PlayfairDisplay", "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_RJ3ijVRyePtLCAAG5c.ttf"),
    ("Raleway", "https://fonts.gstatic.com/s/raleway/v34/1PtgAINQ_asKmgU877jU4nFA5Zq4.ttf"),
]

dest1 = r'C:\t\assets\fonts'
dest2 = r'C:\t\android\app\src\main\assets\fonts'

for name, url in fix_urls:
    p1 = os.path.join(dest1, f"{name}.ttf")
    p2 = os.path.join(dest2, f"{name}.ttf")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
            with open(p1, 'wb') as f1:
                f1.write(data)
            with open(p2, 'wb') as f2:
                f2.write(data)
            test_font = ImageFont.truetype(p1, 12)
            print(f"[FIXED] {name} -> Family: {test_font.getname()[0]}")
    except Exception as e:
        print(f"[FIX FAILED] {name} -> {e}")
