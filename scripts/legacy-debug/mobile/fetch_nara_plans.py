import urllib.request
import json

req = urllib.request.Request(
    'https://router.bynara.id/api/plans',
    headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
)

try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        data = json.loads(html)
        print("Plans list:")
        print(json.dumps(data, indent=2))
except Exception as e:
    print("Error querying plans:", e)
    if hasattr(e, 'read'):
        print("Error response:", e.read().decode('utf-8'))
