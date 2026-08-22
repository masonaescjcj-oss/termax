import urllib.request
import os

fonts_to_download = [
    ("Ubuntu", "https://github.com/google/fonts/raw/main/ofl/ubuntu/Ubuntu-Regular.ttf"),
    ("Merriweather", "https://github.com/google/fonts/raw/main/ofl/merriweather/Merriweather-Regular.ttf"),
    ("PTSans", "https://github.com/google/fonts/raw/main/ofl/ptsans/PTSans-Regular.ttf"),
    ("FiraCode", "https://github.com/google/fonts/raw/main/ofl/firacode/FiraCode-Regular.ttf"),
    ("Quicksand", "https://github.com/google/fonts/raw/main/ofl/quicksand/Quicksand-Regular.ttf"),
    ("Rubik", "https://github.com/google/fonts/raw/main/ofl/rubik/Rubik-Regular.ttf"),
    ("BebasNeue", "https://github.com/google/fonts/raw/main/ofl/bebasneue/BebasNeue-Regular.ttf"),
    ("Kanit", "https://github.com/google/fonts/raw/main/ofl/kanit/Kanit-Regular.ttf"),
    ("Cinzel", "https://github.com/google/fonts/raw/main/ofl/cinzel/Cinzel-Regular.ttf"),
    ("DancingScript", "https://github.com/google/fonts/raw/main/ofl/dancingscript/DancingScript-Regular.ttf"),
    ("Pacifico", "https://github.com/google/fonts/raw/main/ofl/pacifico/Pacifico-Regular.ttf"),
    ("ConcertOne", "https://github.com/google/fonts/raw/main/ofl/concertone/ConcertOne-Regular.ttf"),
    ("Caveat", "https://github.com/google/fonts/raw/main/ofl/caveat/Caveat-Regular.ttf"),
    ("AbrilFatface", "https://github.com/google/fonts/raw/main/ofl/abrilfatface/AbrilFatface-Regular.ttf"),
    ("Lobster", "https://github.com/google/fonts/raw/main/ofl/lobster/Lobster-Regular.ttf"),
    ("Comfortaa", "https://github.com/google/fonts/raw/main/ofl/comfortaa/Comfortaa-Regular.ttf"),
    ("Exo2", "https://github.com/google/fonts/raw/main/ofl/exo2/Exo2-Regular.ttf"),
    ("JosefinSans", "https://github.com/google/fonts/raw/main/ofl/josefinsans/JosefinSans-Regular.ttf"),
    ("Righteous", "https://github.com/google/fonts/raw/main/ofl/righteous/Righteous-Regular.ttf"),
    ("Anton", "https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf"),
    ("Acme", "https://github.com/google/fonts/raw/main/ofl/acme/Acme-Regular.ttf"),
    ("CinzelDecorative", "https://github.com/google/fonts/raw/main/ofl/cinzeldecorative/CinzelDecorative-Regular.ttf"),
    ("PermanentMarker", "https://github.com/google/fonts/raw/main/ofl/permanentmarker/PermanentMarker-Regular.ttf"),
    ("Satisfy", "https://github.com/google/fonts/raw/main/ofl/satisfy/Satisfy-Regular.ttf"),
    ("ShadowsIntoLight", "https://github.com/google/fonts/raw/main/ofl/shadowsintolight/ShadowsIntoLight.ttf"),
    ("GreatVibes", "https://github.com/google/fonts/raw/main/ofl/greatvibes/GreatVibes-Regular.ttf"),
    ("Monoton", "https://github.com/google/fonts/raw/main/ofl/monoton/Monoton-Regular.ttf"),
    ("Fredoka", "https://github.com/google/fonts/raw/main/ofl/fredoka/Fredoka-Regular.ttf"),
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
