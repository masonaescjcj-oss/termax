import urllib.request
import os

fonts_to_download = [
    ("Exo2", "https://github.com/google/fonts/raw/main/ofl/exo2/Exo2-Regular.otf"),
    ("JosefinSans", "https://github.com/google/fonts/raw/main/ofl/josefinsans/JosefinSans-Regular.ttf"),
    ("PermanentMarker", "https://github.com/google/fonts/raw/main/ofl/permanentmarker/PermanentMarker-Regular.ttf"),
    ("Satisfy", "https://github.com/google/fonts/raw/main/ofl/satisfy/Satisfy-Regular.ttf"),
    ("Ubuntu", "https://github.com/google/fonts/raw/main/ofl/ubuntu/Ubuntu-R.ttf"),
    ("Merriweather", "https://github.com/google/fonts/raw/main/ofl/merriweather/Merriweather-Regular.ttf"),
    ("PTSans", "https://github.com/google/fonts/raw/main/ofl/ptsans/PTSans-Regular.ttf"),
    ("Rubik", "https://github.com/google/fonts/raw/main/ofl/rubik/static/Rubik-Regular.ttf"),
    ("Fredoka", "https://github.com/google/fonts/raw/main/ofl/fredoka/static/Fredoka-Regular.ttf"),
    ("Kalam", "https://github.com/google/fonts/raw/main/ofl/kalam/Kalam-Regular.ttf"),
    ("Courgette", "https://github.com/google/fonts/raw/main/ofl/courgette/Courgette-Regular.ttf"),
    ("AmaticSC", "https://github.com/google/fonts/raw/main/ofl/amaticsc/AmaticSC-Regular.ttf"),
    ("BalsamiqSans", "https://github.com/google/fonts/raw/main/ofl/balsamiqsans/BalsamiqSans-Regular.ttf"),
    ("Bangers", "https://github.com/google/fonts/raw/main/ofl/bangers/Bangers-Regular.ttf"),
    ("Creepster", "https://github.com/google/fonts/raw/main/ofl/creepster/Creepster-Regular.ttf"),
    ("PressStart2P", "https://github.com/google/fonts/raw/main/ofl/pressstart2p/PressStart2P-Regular.ttf"),
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
