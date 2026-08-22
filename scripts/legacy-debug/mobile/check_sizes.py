import os

release_dir = r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\android\app\build\outputs\apk\release'

if os.path.exists(release_dir):
    print("Files in release outputs:")
    for root, dirs, files in os.walk(release_dir):
        for file in files:
            path = os.path.join(root, file)
            size_mb = os.path.getsize(path) / (1024 * 1024)
            print(f"- {file} ({size_mb:.2f} MB)")
else:
    print(f"Directory not found: {release_dir}")
