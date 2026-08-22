import os

apk_path = r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\android\app\build\outputs\apk\release\app-release.apk'

if os.path.exists(apk_path):
    size_mb = os.path.getsize(apk_path) / (1024 * 1024)
    print(f"APK_FOUND: {apk_path}")
    print(f"SIZE: {size_mb:.2f} MB")
else:
    print(f"APK_NOT_FOUND: {apk_path}")
    # Search under build/outputs
    search_dir = r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\android\app\build\outputs'
    if os.path.exists(search_dir):
        print("Searching in outputs directory...")
        for root, dirs, files in os.walk(search_dir):
            for file in files:
                if file.endswith('.apk'):
                    print(f"FOUND alternate APK: {os.path.join(root, file)}")
