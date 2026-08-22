import urllib.request
import os

fonts_to_download = [
    ("Bangers", "https://github.com/google/fonts/raw/main/ofl/bangers/Bangers-Regular.ttf"),
    ("Creepster", "https://github.com/google/fonts/raw/main/ofl/creepster/Creepster-Regular.ttf"),
    ("PressStart2P", "https://github.com/google/fonts/raw/main/ofl/pressstart2p/PressStart2P-Regular.ttf"),
    ("LuckiestGuy", "https://github.com/google/fonts/raw/main/apache/luckiestguy/LuckiestGuy-Regular.ttf"),
    ("Orbitron", "https://github.com/google/fonts/raw/main/ofl/orbitron/Orbitron%5Bwght%5D.ttf"),
    ("Sacramento", "https://github.com/google/fonts/raw/main/ofl/sacramento/Sacramento-Regular.ttf"),
    ("SpecialElite", "https://github.com/google/fonts/raw/main/ofl/specialelite/SpecialElite-Regular.ttf"),
]

dest_dir1 = r'C:\t\assets\fonts'
dest_dir2 = r'C:\t\android\app\src\main\assets\fonts'

for name, url in fonts_to_download:
    filename = f"{name}.ttf"
    p1 = os.path.join(dest_dir1, filename)
    p2 = os.path.join(dest_dir2, filename)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(p1, 'wb') as f1:
            data = response.read()
            f1.write(data)
            with open(p2, 'wb') as f2:
                f2.write(data)
        print(f"Successfully downloaded {name}")
    except Exception as e:
        print(f"Failed {name}: {e}")
