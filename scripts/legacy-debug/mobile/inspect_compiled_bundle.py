import urllib.request
import ssl
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

js_url = "https://dist-5adzq15u3-isaacs-projects-dad539ec.vercel.app/_expo/static/js/web/entry-4c81382f539d8d31a3a608be626b4a99.js"

print("Downloading bundle from Vercel...")
req = urllib.request.Request(js_url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
    code = resp.read().decode('utf-8', errors='ignore')
    print("Bundle downloaded, length:", len(code))
    
    # Search for backend URLs in bundle
    matches = re.findall(r'https?://[a-zA-Z0-9\.-]+(?::\d+)?', code)
    unique_urls = sorted(list(set(matches)))
    print("\nURLs found in bundle:")
    for u in unique_urls:
        if 'schema.org' not in u and 'w3.org' not in u and 'facebook' not in u and 'reactnative' not in u:
            print(" -", u)
