import os

def list_large_entries(path):
    entries = []
    try:
        for entry in os.scandir(path):
            if entry.is_file():
                entries.append((entry.path, entry.stat().st_size))
            elif entry.is_dir(follow_symlinks=False):
                # calculate size
                size = 0
                for root, dirs, files in os.walk(entry.path):
                    for file in files:
                        try:
                            size += os.path.getsize(os.path.join(root, file))
                        except Exception:
                            pass
                entries.append((entry.path, size))
    except Exception:
        pass
    entries.sort(key=lambda x: x[1], reverse=True)
    for p, s in entries[:25]:
        print(f"{s / (1024*1024):.2f} MB - {p}")

list_large_entries(r'C:\t')
