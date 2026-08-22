import urllib.request
import json
import ssl

def check_health():
    url = "https://45-129-126-98.sslip.io/api/health"
    print(f"Testing VPS production health endpoint: {url} ...")
    
    # Disable SSL verification checks just in case, but Let's Encrypt should be fully trusted
    ctx = ssl.create_default_context()
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx) as response:
            status_code = response.getcode()
            body = response.read().decode('utf-8')
            print(f"Status Code: {status_code}")
            print(f"Response Body:\n{body}")
    except Exception as e:
        print(f"Error checking health: {e}")

if __name__ == '__main__':
    check_health()
