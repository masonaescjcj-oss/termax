import os

def find_file(filename, search_path):
    print(f"Searching for {filename} in {search_path}...")
    for root, dirs, files in os.walk(search_path):
        if filename in files:
            full_path = os.path.join(root, filename)
            print(f"Found: {full_path}")
            return full_path
    print("Not found.")
    return None

find_file('cloudflared.exe', r'C:\Users\asiac')
