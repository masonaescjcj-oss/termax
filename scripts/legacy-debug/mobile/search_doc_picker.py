with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\package.json', 'r', encoding='utf-8') as f:
    for line in f:
        if 'document-picker' in line or 'document' in line:
            print(line.strip())
