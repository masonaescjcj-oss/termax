import os
import subprocess

try:
    # On Windows, we can use fsutil or dir command to see the target of a junction
    res = subprocess.run('cmd /c dir C:\\', capture_output=True, text=True)
    for line in res.stdout.splitlines():
        if '<JUNCTION>' in line and ' t ' in line:
            print(line.strip())
except Exception as e:
    print("Error:", e)
