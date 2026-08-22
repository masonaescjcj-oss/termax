import os

files = ['PositionsScreen.jsx', 'PositionsScreen_clean.js', 'PositionsScreen_compiled.js']
for f in files:
    path = os.path.join(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens', f)
    if os.path.exists(path):
        print(f"{f}: size={os.path.getsize(path)}")
