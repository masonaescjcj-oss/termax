import os

src_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\src"
target_term = "Connect Broker"

found = []
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if target_term in content:
                        found.append(path)
            except Exception as e:
                pass

print("FOUND_FILES:")
for f in found:
    print(f"- {f}")
