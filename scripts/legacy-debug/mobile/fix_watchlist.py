import re

with open(r'C:\t\src\screens\WatchlistScreen.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
    
content = re.sub(r'fontFamily:\s*Platform\.OS\s*===\s*[\'"]web[\'"]\s*\?\s*[\'"][^\'"]*[\'"]\s*:\s*undefined\s*,?\s*', '', content)

with open(r'C:\t\src\screens\WatchlistScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed WatchlistScreen.tsx')
