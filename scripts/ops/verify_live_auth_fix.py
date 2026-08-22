import urllib.request
import ssl
import json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

backend_url = "https://45-129-126-98.sslip.io"

print("1. Testing Auth Login POST Endpoint...")
try:
    data = json.dumps({"telegramId": 123456789, "username": "test_user"}).encode('utf-8')
    req = urllib.request.Request(
        f"{backend_url}/api/v1/auth/login",
        data=data,
        headers={
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/json'
        },
        method='POST'
    )
    with urllib.request.urlopen(req, context=ctx, timeout=5) as resp:
        print("POST Login Status:", resp.status)
        res_data = json.loads(resp.read().decode('utf-8'))
        print("POST Login Response Success:", res_data.get('success'))
        print("User Profile ID:", res_data.get('data', {}).get('user', {}).get('id'))
except Exception as e:
    print("POST Login Error:", e)

print("\n2. Testing Market Promoted Symbols Endpoint...")
try:
    req = urllib.request.Request(
        f"{backend_url}/api/v1/market/promoted",
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(req, context=ctx, timeout=5) as resp:
        print("Promoted Symbols Status:", resp.status)
        res_data = json.loads(resp.read().decode('utf-8'))
        print("Promoted Symbols Success:", res_data.get('success'))
        print("Promoted Symbols Count:", len(res_data.get('data', [])))
except Exception as e:
    print("Promoted Symbols Error:", e)
