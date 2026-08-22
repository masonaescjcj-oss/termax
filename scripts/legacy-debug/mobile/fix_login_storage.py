import re

with open(r'C:\t\src\screens\LoginScreen.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "await getItemAsync('selectedAppFont')",
    "await AsyncStorage.getItem('selectedAppFont')"
)

if 'import AsyncStorage from' not in content:
    content = content.replace(
        "import { setItemAsync, deleteItemAsync, getItemAsync } from '../utils/storage';",
        "import { setItemAsync, deleteItemAsync, getItemAsync } from '../utils/storage';\nimport AsyncStorage from '@react-native-async-storage/async-storage';"
    )

with open(r'C:\t\src\screens\LoginScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
