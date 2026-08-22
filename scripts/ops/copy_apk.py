import shutil
import os

src = r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\android\app\build\outputs\apk\release\app-release.apk'
dest = r'c:\Users\asiac\OneDrive\Desktop\trade (2)\ترمکس.apk'

try:
    if os.path.exists(src):
        shutil.copy(src, dest)
        print(f"COPY_SUCCESSFUL: Copied to {dest}")
        print(f"Size: {os.path.getsize(dest)/(1024*1024):.2f} MB")
    else:
        print(f"ERROR: Source APK not found at {src}")
except Exception as e:
    print(f"Error copying APK: {e}")
