with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\.env', 'r', encoding='utf-8') as f:
    for line in f:
        if 'SUPABASE' in line:
            print(line.strip().encode('ascii', 'ignore').decode('ascii'))
