import os

known_hosts_path = r"C:\Users\asiac\.ssh\known_hosts"
if os.path.exists(known_hosts_path):
    with open(known_hosts_path, 'r', encoding='utf-8') as f:
        for line in f:
            parts = line.split()
            if parts:
                print(parts[0])
else:
    print("known_hosts not found")
