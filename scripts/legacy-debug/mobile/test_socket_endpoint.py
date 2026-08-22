import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url_polling = "https://45-129-126-98.sslip.io/socket.io/?EIO=4&transport=polling"
req = urllib.request.Request(url_polling, headers={'User-Agent': 'Mozilla/5.0'})

try:
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        print("Polling Response Code:", resp.status)
        body = resp.read().decode('utf-8')
        print("Polling Body:", body)
except Exception as e:
    print("Polling Error:", e)
