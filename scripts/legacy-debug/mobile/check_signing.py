with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\android\app\build.gradle', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'signingConfigs' in line or 'signingConfig' in line or 'release {' in line:
            print(f"{i+1}: {line.strip()[:100]}")
