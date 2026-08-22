import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = "https://45-129-126-98.sslip.io/api/v1/market/prices"
print("Testing:", url)
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        print("Status Code:", resp.status)
        print("Response Sample:", resp.read().decode('utf-8', errors='ignore')[:300])
except Exception as e:
    print("Error:", e)
