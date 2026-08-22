import os
import re

def fix_file(path):
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    orig_content = content
    
    # Check if Typography is already imported
    has_typo = 'components/Typography' in content
    
    if path.endswith('PositionsScreen.jsx') or 'PositionsScreen' in path:
        # For PositionsScreen compiled/js files
        # Replace `import { View, Text, StyleSheet... } from 'react-native';`
        content = re.sub(
            r'import\s+\{\s*View,\s*Text,\s*StyleSheet,\s*FlatList,\s*TouchableOpacity,\s*SafeAreaView,\s*Platform,\s*ActivityIndicator,\s*Linking,\s*TextInput,\s*Modal,\s*PanResponder\s*\}\s+from\s+[\'"]react-native[\'"];',
            "import { View, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, Linking, Modal, PanResponder } from 'react-native';\nimport { Text, TextInput } from '../components/Typography';",
            content
        )
        # Also replace mock requires if present
        content = content.replace("case 2: return wrapDefault(Text);", "case 2: return wrapDefault(require('../components/Typography').Text);")
        content = content.replace("case 9: return wrapDefault(TextInput);", "case 9: return wrapDefault(require('../components/Typography').TextInput);")
    
    elif path.endswith('ChatScreen.jsx'):
        # For ChatScreen.jsx
        content = content.replace('Text,\n', '')
        content = content.replace('TextInput,\n', '')
        if 'components/Typography' not in content:
            content = content.replace("import io from 'socket.io-client';", "import { Text, TextInput } from '../components/Typography';\nimport io from 'socket.io-client';")

    elif path.endswith('ToolsHubScreen.jsx'):
        # For ToolsHubScreen.jsx
        content = content.replace('View, Text,', 'View,')
        content = content.replace(', TextInput,', ',')
        if 'components/Typography' not in content:
            content = content.replace("import GlassView from '../components/GlassView';", "import { Text, TextInput } from '../components/Typography';\nimport GlassView from '../components/GlassView';")

    if content != orig_content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {os.path.basename(path)}")
    else:
        print(f"No changes needed for {os.path.basename(path)}")

for p in [
    r'C:\t\src\screens\ChatScreen.jsx',
    r'C:\t\src\screens\ToolsHubScreen.jsx',
    r'C:\t\src\screens\PositionsScreen.jsx',
    r'C:\t\src\screens\PositionsScreen_clean.js',
    r'C:\t\src\screens\PositionsScreen_compiled.js',
    r'C:\t\src\screens\PositionsScreen_compiled_2.js',
]:
    fix_file(p)
