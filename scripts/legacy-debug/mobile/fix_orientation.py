import re

with open(r'C:\t\src\screens\ChartScreen.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import
if 'expo-screen-orientation' not in content:
    content = content.replace(
        "import React, { useState, useEffect, useRef, useMemo } from 'react';",
        "import React, { useState, useEffect, useRef, useMemo } from 'react';\nimport * as ScreenOrientation from 'expo-screen-orientation';"
    )

new_toggle = '''  const toggleFullscreen = async () => {
    const nextFullscreen = !isFullscreen;
    setIsFullscreen(nextFullscreen);
    if (Platform.OS !== 'web') {
      if (nextFullscreen) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    }
    if (Platform.OS === 'web') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };'''

# Replace toggleFullscreen block
content = re.sub(
    r'const toggleFullscreen = \(\) => \{[\s\S]*?(?=\s+const handleAssetSelect)', 
    new_toggle + '\n\n', 
    content
)

cleanup_effect = '''  useEffect(() => {
    return () => {
      if (Platform.OS !== 'web') {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
    };
  }, []);'''
  
if 'ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)' not in content:
    content = content.replace(
        '  const toggleFullscreen = async',
        cleanup_effect + '\n\n  const toggleFullscreen = async'
    )

# Remove Overlay 1
content = re.sub(
    r'\{\/\* Rotate Your Phone Overlay \(Image 1\) \*\/\}.*?\{\/\* Rotate Back to Portrait Overlay \(Image 3\) \*\/\}',
    '',
    content,
    flags=re.DOTALL
)

# Remove Overlay 3
content = re.sub(
    r'\{\/\* Rotate Back to Portrait Overlay \(Image 3\) \*\/\}.*?(?=\<\/View\>\s*\<\/View\>)',
    '',
    content,
    flags=re.DOTALL
)

with open(r'C:\t\src\screens\ChartScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated ChartScreen.tsx successfully.')
