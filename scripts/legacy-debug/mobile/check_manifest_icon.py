import os
import re

with open(r'C:\t\app.json', 'r', encoding='utf-8') as f:
    print("app.json:")
    print(f.read())

with open(r'C:\t\android\app\src\main\AndroidManifest.xml', 'r', encoding='utf-8') as f:
    print("\nAndroidManifest.xml:")
    print(f.read())
