import urllib.request
import os
from PIL import ImageFont

fonts_60 = [
    # 1-12: The original ones (downloading valid TTF versions)
    ("Montserrat", "https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf"),
    ("Inter", "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf"),
    ("Roboto", "https://github.com/google/fonts/raw/main/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf"),
    ("Poppins", "https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Regular.ttf"),
    ("SpaceGrotesk", "https://github.com/google/fonts/raw/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf"),
    ("Outfit", "https://github.com/google/fonts/raw/main/ofl/outfit/Outfit%5Bwght%5D.ttf"),
    ("Lato", "https://github.com/google/fonts/raw/main/ofl/lato/Lato-Regular.ttf"),
    ("OpenSans", "https://github.com/google/fonts/raw/main/ofl/opensans/OpenSans%5Bwdth%2Cwght%5D.ttf"),
    ("Oswald", "https://github.com/google/fonts/raw/main/ofl/oswald/Oswald%5Bwght%5D.ttf"),
    ("Raleway", "https://github.com/google/fonts/raw/main/ofl/raleway/Raleway%5Bital%2Cwght%5D.ttf"),
    ("Nunito", "https://github.com/google/fonts/raw/main/ofl/nunito/Nunito%5Bital%2Cwght%5D.ttf"),
    ("PlayfairDisplay", "https://github.com/google/fonts/raw/main/ofl/playfairdisplay/PlayfairDisplay%5Bital%2Cwght%5D.ttf"),
    
    # 13-40: Additional previously downloaded ones
    ("AbrilFatface", "https://github.com/google/fonts/raw/main/ofl/abrilfatface/AbrilFatface-Regular.ttf"),
    ("Acme", "https://github.com/google/fonts/raw/main/ofl/acme/Acme-Regular.ttf"),
    ("AmaticSC", "https://github.com/google/fonts/raw/main/ofl/amaticsc/AmaticSC-Regular.ttf"),
    ("Anton", "https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf"),
    ("BalsamiqSans", "https://github.com/google/fonts/raw/main/ofl/balsamiqsans/BalsamiqSans-Regular.ttf"),
    ("Bangers", "https://github.com/google/fonts/raw/main/ofl/bangers/Bangers-Regular.ttf"),
    ("BebasNeue", "https://github.com/google/fonts/raw/main/ofl/bebasneue/BebasNeue-Regular.ttf"),
    ("Caveat", "https://github.com/google/fonts/raw/main/ofl/caveat/Caveat%5Bwght%5D.ttf"),
    ("Cinzel", "https://github.com/google/fonts/raw/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf"),
    ("CinzelDecorative", "https://github.com/google/fonts/raw/main/ofl/cinzeldecorative/CinzelDecorative-Regular.ttf"),
    ("Comfortaa", "https://github.com/google/fonts/raw/main/ofl/comfortaa/Comfortaa%5Bwght%5D.ttf"),
    ("ConcertOne", "https://github.com/google/fonts/raw/main/ofl/concertone/ConcertOne-Regular.ttf"),
    ("Courgette", "https://github.com/google/fonts/raw/main/ofl/courgette/Courgette-Regular.ttf"),
    ("Creepster", "https://github.com/google/fonts/raw/main/ofl/creepster/Creepster-Regular.ttf"),
    ("DancingScript", "https://github.com/google/fonts/raw/main/ofl/dancingscript/DancingScript%5Bwght%5D.ttf"),
    ("FiraCode", "https://github.com/google/fonts/raw/main/ofl/firacode/FiraCode%5Bwght%5D.ttf"),
    ("GreatVibes", "https://github.com/google/fonts/raw/main/ofl/greatvibes/GreatVibes-Regular.ttf"),
    ("Kalam", "https://github.com/google/fonts/raw/main/ofl/kalam/Kalam-Regular.ttf"),
    ("Kanit", "https://github.com/google/fonts/raw/main/ofl/kanit/Kanit-Regular.ttf"),
    ("Lobster", "https://github.com/google/fonts/raw/main/ofl/lobster/Lobster-Regular.ttf"),
    ("LuckiestGuy", "https://github.com/google/fonts/raw/main/apache/luckiestguy/LuckiestGuy-Regular.ttf"),
    ("Monoton", "https://github.com/google/fonts/raw/main/ofl/monoton/Monoton-Regular.ttf"),
    ("Orbitron", "https://github.com/google/fonts/raw/main/ofl/orbitron/Orbitron%5Bwght%5D.ttf"),
    ("Pacifico", "https://github.com/google/fonts/raw/main/ofl/pacifico/Pacifico-Regular.ttf"),
    ("PressStart2P", "https://github.com/google/fonts/raw/main/ofl/pressstart2p/PressStart2P-Regular.ttf"),
    ("Quicksand", "https://github.com/google/fonts/raw/main/ofl/quicksand/Quicksand%5Bwght%5D.ttf"),
    ("Righteous", "https://github.com/google/fonts/raw/main/ofl/righteous/Righteous-Regular.ttf"),
    ("ShadowsIntoLight", "https://github.com/google/fonts/raw/main/ofl/shadowsintolight/ShadowsIntoLight.ttf"),

    # 41-60: 20 BRAND NEW top mobile app fonts!
    ("Sora", "https://github.com/google/fonts/raw/main/ofl/sora/Sora%5Bwght%5D.ttf"),
    ("PlusJakartaSans", "https://github.com/google/fonts/raw/main/ofl/plusjakartasans/PlusJakartaSans%5Bital%2Cwght%5D.ttf"),
    ("Urbanist", "https://github.com/google/fonts/raw/main/ofl/urbanist/Urbanist%5Bital%2Cwght%5D.ttf"),
    ("Manrope", "https://github.com/google/fonts/raw/main/ofl/manrope/Manrope%5Bwght%5D.ttf"),
    ("DmSans", "https://github.com/google/fonts/raw/main/ofl/dmsans/DMSans%5Bopsz%2Cwght%5D.ttf"),
    ("Syne", "https://github.com/google/fonts/raw/main/ofl/syne/Syne%5Bwght%5D.ttf"),
    ("Lexend", "https://github.com/google/fonts/raw/main/ofl/lexend/Lexend%5Bwght%5D.ttf"),
    ("WorkSans", "https://github.com/google/fonts/raw/main/ofl/worksans/WorkSans%5Bital%2Cwght%5D.ttf"),
    ("RedHatDisplay", "https://github.com/google/fonts/raw/main/ofl/redhatdisplay/RedHatDisplay%5Bital%2Cwght%5D.ttf"),
    ("Epilogue", "https://github.com/google/fonts/raw/main/ofl/epilogue/Epilogue%5Bital%2Cwght%5D.ttf"),
    ("SpaceMono", "https://github.com/google/fonts/raw/main/ofl/spacemono/SpaceMono-Regular.ttf"),
    ("ChakraPetch", "https://github.com/google/fonts/raw/main/ofl/chakrapetch/ChakraPetch-Regular.ttf"),
    ("Rajdhani", "https://github.com/google/fonts/raw/main/ofl/rajdhani/Rajdhani-Regular.ttf"),
    ("TitanOne", "https://github.com/google/fonts/raw/main/ofl/titanone/TitanOne-Regular.ttf"),
    ("AlfaSlabOne", "https://github.com/google/fonts/raw/main/ofl/alfaslabone/AlfaSlabOne-Regular.ttf"),
    ("Shrikhand", "https://github.com/google/fonts/raw/main/ofl/shrikhand/Shrikhand-Regular.ttf"),
    ("RussoOne", "https://github.com/google/fonts/raw/main/ofl/russoone/RussoOne-Regular.ttf"),
    ("Fredoka", "https://github.com/google/fonts/raw/main/ofl/fredoka/Fredoka%5Bwght%5D.ttf"),
    ("Sacramento", "https://github.com/google/fonts/raw/main/ofl/sacramento/Sacramento-Regular.ttf"),
    ("Silkscreen", "https://github.com/google/fonts/raw/main/ofl/silkscreen/Silkscreen-Regular.ttf"),
]

dest1 = r'C:\t\assets\fonts'
dest2 = r'C:\t\android\app\src\main\assets\fonts'

success_count = 0
failed_list = []

for name, url in fonts_60:
    filename = f"{name}.ttf"
    p1 = os.path.join(dest1, filename)
    p2 = os.path.join(dest2, filename)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = response.read()
            with open(p1, 'wb') as f1:
                f1.write(data)
            with open(p2, 'wb') as f2:
                f2.write(data)
            
            test_font = ImageFont.truetype(p1, 12)
            print(f"[SUCCESS] {name:20s} -> Valid TTF! Family: {test_font.getname()[0]}")
            success_count += 1
    except Exception as e:
        print(f"[FAILED]  {name:20s} -> Error: {e}")
        failed_list.append((name, url))

print(f"\nTotal successfully downloaded and verified valid fonts: {success_count}/60")
