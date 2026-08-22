with open(r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\controllers\adminController.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    print(f"Total lines: {len(lines)}")
    # Print the last 40 lines
    for i in range(len(lines) - 40, len(lines)):
        print(f"{i+1}: {lines[i].strip()[:100]}")
