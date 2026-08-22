with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src\screens\EarnNftScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'fetchCampaign' in line or 'verify' in line.lower() or 'progress' in line.lower() or 'useEffect' in line:
            print(f"{i+1}: {line.strip()}")
