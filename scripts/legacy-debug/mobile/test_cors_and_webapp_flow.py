import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

origin = "https://dist-5adzq15u3-isaacs-projects-dad539ec.vercel.app"
backend_url = "https://45-129-126-98.sslip.io"

print("1. Testing OPTIONS Preflight request with Origin:", origin)
try:
    req = urllib.request.Request(
        f"{backend_url}/api/v1/market/prices",
        headers={
            'User-Agent': 'Mozilla/5.0',
            'Origin': origin,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'authorization,content-type'
        },
        method='OPTIONS'
    )
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        print("OPTIONS Status Code:", resp.status)
        print("CORS Headers:")
        for k, v in resp.headers.items():
            if 'access-control' in k.lower():
                print(f" - {k}: {v}")
except Exception as e:
    print("OPTIONS Preflight Error:", e)

print("\n2. Testing GET request with Origin:", origin)
try:
    req = urllib.request.Request(
        f"{backend_url}/api/v1/market/prices",
        headers={
            'User-Agent': 'Mozilla/5.0',
            'Origin': origin
        }
    )
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        print("GET Status Code:", resp.status)
        print("CORS Headers:")
        for k, v in resp.headers.items():
            if 'access-control' in k.lower():
                print(f" - {k}: {v}")
except Exception as e:
    print("GET Error:", e)

print("\n3. Testing Auth Login POST request with Origin:", origin)
try:
    data = '{"username":"test_tg","password":"test_password"}'.encode('utf-8')
    req = urllib.request.Request(
        f"{backend_url}/api/v1/auth/login",
        data=data,
        headers={
            'User-Agent': 'Mozilla/5.0',
            'Origin': origin,
            'Content-Type': 'application/json'
        },
        method='POST'
    )
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        print("POST Login Status Code:", resp.status)
        body = resp.read().decode('utf-8')
        print("Response Body:", body)
except urllib.error.HTTPError as e:
    print("POST Login HTTP Status:", e.code)
    body = e.read().decode('utf-8')
    print("Response Body:", body)
except Exception as e:
    print("POST Login Error:", e)
