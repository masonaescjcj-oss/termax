import zipfile

zip_path = r"c:\Users\asiac\OneDrive\Desktop\termax_trade_clean_source.zip"

with zipfile.ZipFile(zip_path, 'r') as z:
    file_list = []
    for info in z.infolist():
        file_list.append((info.filename, info.file_size, info.compress_size))
        
    file_list.sort(key=lambda x: x[1], reverse=True)
    
    print("=== TOP 15 LARGEST FILES IN ZIP ===")
    for fname, size, csize in file_list[:15]:
        print(f"{fname} -> {size / 1024 / 1024:.2f} MB (Compressed: {csize / 1024 / 1024:.2f} MB)")
