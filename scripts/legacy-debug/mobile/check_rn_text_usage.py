import os

src_dir = r'C:\t\src'
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.tsx', '.jsx', '.js', '.ts')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                if 'RNText' in content or 'TextProps' in content:
                    print(f"File using RNText/TextProps: {file}")
