import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

urls = [
    "https://mobile-mauve-one.vercel.app",
    "https://dist-5adzq15u3-isaacs-projects-dad539ec.vercel.app"
]

for url in urls:
    print("Testing URL:", url)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx, timeout=5) as resp:
            print(" -> Status:", resp.status)
            print(" -> Length:", len(resp.read()))
    except Exception as e:
        print(" -> Error:", e)
