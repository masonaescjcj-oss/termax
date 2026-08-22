with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\utils\mapper.ts', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'mapCampaign' in line:
            print(f"{i+1}: {line.strip()}")
