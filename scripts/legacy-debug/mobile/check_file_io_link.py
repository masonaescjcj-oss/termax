import urllib.request

try:
    req = urllib.request.Request(
        'https://file.io/y2g3b5k2',
        method='HEAD',
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(req) as response:
        size = int(response.headers.get('Content-Length', 0))
        print("File size on file.io:", size / (1024*1024), "MB")
except Exception as e:
    print("Error checking link:", e)
