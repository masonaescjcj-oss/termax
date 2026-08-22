import os
print("C:\\p exists:", os.path.exists(r'C:\p'))
if os.path.exists(r'C:\p'):
    print("Is junction/link:", os.path.islink(r'C:\p'))
    try:
        print("List dir C:\\p:", os.listdir(r'C:\p')[:10])
    except Exception as e:
        print("Error listing C:\\p:", e)
