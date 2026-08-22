import urllib.request
import ssl
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = "https://dist-5adzq15u3-isaacs-projects-dad539ec.vercel.app"
print("Testing Vercel site:", url)

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
        print("HTTP Status:", resp.status)
        print("HTML snippet:\n", html[:400])
        
        # Find script tags in HTML
        js_files = re.findall(r'src="([^"]+\.js)"', html)
        print("\nFound JS files:", js_files)
        
        for js in js_files:
            js_url = js if js.startswith('http') else url.rstrip('/') + '/' + js.lstrip('/')
            print(f"Testing JS asset: {js_url}")
            try:
                js_req = urllib.request.Request(js_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(js_req, context=ctx, timeout=10) as js_resp:
                    print(f"  -> JS Asset Status: {js_resp.status}, length: {len(js_resp.read())}")
            except Exception as e:
                print(f"  -> JS Asset ERROR: {e}")

except Exception as e:
    print("Vercel Site Error:", e)
