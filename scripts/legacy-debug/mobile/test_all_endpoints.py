import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

urls = {
    "Trade Socket": "https://45-129-126-98.sslip.io/socket.io/?EIO=4&transport=polling",
    "Trade Health API": "https://45-129-126-98.sslip.io/api/health",
    "Trade Promoted API": "https://45-129-126-98.sslip.io/api/v1/market/promoted",
    "Root URL (Other App)": "https://45-129-126-98.sslip.io/"
}

for name, url in urls.items():
    print(f"\n--- Testing {name} ({url}) ---")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx, timeout=5) as resp:
            print("Status Code:", resp.status)
            body = resp.read().decode('utf-8', errors='ignore')
            print("Response Sample:", body[:150])
    except Exception as e:
        print("Error:", e)
