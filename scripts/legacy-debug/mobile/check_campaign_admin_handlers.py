with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\controllers\campaignController.ts', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'createCampaign' in line or 'updateCampaign' in line or 'admin' in line.lower() or 'post' in line.lower() or 'put' in line.lower():
            print(f"{i+1}: {line.strip()}")
