import urllib.request
import os

fonts_to_download = [
    ("DancingScript", "https://github.com/google/fonts/raw/main/ofl/dancingscript/DancingScript%5Bwght%5D.ttf"),
    ("Caveat", "https://github.com/google/fonts/raw/main/ofl/caveat/Caveat%5Bwght%5D.ttf"),
    ("Cinzel", "https://github.com/google/fonts/raw/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf"),
    ("Comfortaa", "https://github.com/google/fonts/raw/main/ofl/comfortaa/Comfortaa%5Bwght%5D.ttf"),
    ("Exo2", "https://github.com/google/fonts/raw/main/ofl/exo2/Exo2%5Bital%2Cwght%5D.ttf"),
    ("Fredoka", "https://github.com/google/fonts/raw/main/ofl/fredoka/Fredoka%5Bwght%5D.ttf"),
    ("JosefinSans", "https://github.com/google/fonts/raw/main/ofl/josefinsans/JosefinSans%5Bital%2Cwght%5D.ttf"),
    ("Monoton", "https://github.com/google/fonts/raw/main/ofl/monoton/Monoton-Regular.ttf"),
    ("PermanentMarker", "https://github.com/google/fonts/raw/main/ofl/permanentmarker/PermanentMarker-Regular.ttf"),
    ("Quicksand", "https://github.com/google/fonts/raw/main/ofl/quicksand/Quicksand%5Bwght%5D.ttf"),
    ("Rubik", "https://github.com/google/fonts/raw/main/ofl/rubik/Rubik%5Bital%2Cwght%5D.ttf"),
    ("Satisfy", "https://github.com/google/fonts/raw/main/ofl/satisfy/Satisfy-Regular.ttf"),
    ("Ubuntu", "https://github.com/google/fonts/raw/main/ofl/ubuntu/Ubuntu-Regular.ttf"),
    ("Merriweather", "https://github.com/google/fonts/raw/main/ofl/merriweather/Merriweather-Regular.ttf"),
    ("PTSans", "https://github.com/google/fonts/raw/main/ofl/ptsans/PTSans-Regular.ttf"),
    ("FiraCode", "https://github.com/google/fonts/raw/main/ofl/firacode/FiraCode%5Bwght%5D.ttf"),
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
