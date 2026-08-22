import os
import re

files_to_check = [
    r'C:\t\src\screens\ChatScreen.jsx',
    r'C:\t\src\screens\PositionsScreen.jsx',
    r'C:\t\src\screens\PositionsScreen_clean.js',
    r'C:\t\src\screens\PositionsScreen_compiled.js',
    r'C:\t\src\screens\PositionsScreen_compiled_2.js',
    r'C:\t\src\screens\ToolsHubScreen.jsx',
]

for p in files_to_check:
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Check how Text is imported in react-native import line
        # e.g. import { View, Text, StyleSheet... } from 'react-native';
        print(f"\nChecking {os.path.basename(p)}:")
        for line in content.splitlines()[:15]:
            if 'react-native' in line:
                print("  RN Import:", line)
